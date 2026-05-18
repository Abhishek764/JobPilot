import { createHash } from 'node:crypto';

import { prisma } from '@jobpilot/db';

import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';

const REDIS_PREFIX = 'ai:cache:';

export interface CacheEntry<T = unknown> {
  response: T;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export const hashPrompt = (
  operation: string,
  model: string,
  payload: unknown,
): string => {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return createHash('sha256').update(`${operation}|${model}|${json}`).digest('hex');
};

export const aiCache = {
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await redis.get(REDIS_PREFIX + key);
      if (cached) return JSON.parse(cached) as CacheEntry<T>;
    } catch (err) {
      logger.warn({ err: String(err) }, 'ai cache redis read failed');
    }

    const row = await prisma.aiCache.findUnique({ where: { key } });
    if (!row) return null;
    if (row.expiresAt < new Date()) {
      await prisma.aiCache.delete({ where: { key } }).catch(() => undefined);
      return null;
    }

    const entry: CacheEntry<T> = {
      response: row.response as T,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      model: row.model,
    };
    await this.warmRedis(key, entry, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000));
    await prisma.aiCache.update({ where: { key }, data: { hits: { increment: 1 } } }).catch(() => undefined);
    return entry;
  },

  async set<T>(key: string, operation: string, entry: CacheEntry<T>): Promise<void> {
    const ttl = env.AI_CACHE_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await Promise.allSettled([
      this.warmRedis(key, entry, ttl),
      prisma.aiCache.upsert({
        where: { key },
        create: {
          key,
          operation,
          model: entry.model,
          response: entry.response as object,
          tokensIn: entry.tokensIn,
          tokensOut: entry.tokensOut,
          expiresAt,
        },
        update: {
          model: entry.model,
          response: entry.response as object,
          tokensIn: entry.tokensIn,
          tokensOut: entry.tokensOut,
          expiresAt,
        },
      }),
    ]);
  },

  async warmRedis<T>(key: string, entry: CacheEntry<T>, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await redis.set(REDIS_PREFIX + key, JSON.stringify(entry), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err: String(err) }, 'ai cache redis write failed');
    }
  },
};
