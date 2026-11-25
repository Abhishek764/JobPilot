import { env } from '../../../config/env';
import { redis } from '../../../config/redis';

/** When each feed last synced successfully, kept in Redis so restarts don't reset it. */
export interface LastRunStore {
  get(platform: string): Promise<number | null>;
  set(platform: string, at: number): Promise<void>;
}

const key = (platform: string) => `${env.BULL_PREFIX}:feed:last-run:${platform}`;

export const redisLastRun: LastRunStore = {
  async get(platform) {
    const v = await redis.get(key(platform));
    return v ? Number(v) : null;
  },
  async set(platform, at) {
    await redis.set(key(platform), String(at));
  },
};
