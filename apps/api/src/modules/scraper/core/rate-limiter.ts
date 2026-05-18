import { redis } from '../../../config/redis';

/**
 * Sliding-window rate limiter keyed by platform.
 * Uses a Redis sorted set of request timestamps; one ZADD + ZREMRANGEBYSCORE + ZCARD
 * per attempt. Returns delayMs needed before the next attempt, or 0 if allowed.
 */
export class RedisRateLimiter {
  private readonly prefix: string;

  constructor(prefix = 'scrape:rl') {
    this.prefix = prefix;
  }

  private key(bucket: string): string {
    return `${this.prefix}:${bucket}`;
  }

  async acquire(bucket: string, capacity: number, windowMs = 60_000): Promise<number> {
    const key = this.key(bucket);
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zrange(key, 0, 0, 'WITHSCORES');
    const results = await pipeline.exec();
    if (!results) return 0;

    const count = Number(results[1]?.[1] ?? 0);
    if (count < capacity) {
      await redis.zadd(key, now, `${now}:${Math.random()}`);
      await redis.pexpire(key, windowMs * 2);
      return 0;
    }
    const oldestScore = Number((results[2]?.[1] as string[] | undefined)?.[1] ?? now);
    return Math.max(0, oldestScore + windowMs - now);
  }

  async waitAndAcquire(
    bucket: string,
    capacity: number,
    windowMs = 60_000,
    maxWaitMs = 60_000,
  ): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    let delay = await this.acquire(bucket, capacity, windowMs);
    while (delay > 0) {
      if (Date.now() + delay > deadline) {
        throw new Error(`rate limit timeout for ${bucket}`);
      }
      await new Promise((r) => setTimeout(r, Math.min(delay, 5_000)));
      delay = await this.acquire(bucket, capacity, windowMs);
    }
  }
}

export const rateLimiter = new RedisRateLimiter();
