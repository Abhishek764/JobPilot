import { beforeEach, describe, expect, it, vi } from 'vitest';

const add = vi.hoisted(() => vi.fn());
const getRepeatableJobs = vi.hoisted(() => vi.fn());
const removeRepeatableByKey = vi.hoisted(() => vi.fn());
vi.mock('bullmq', () => ({
  Queue: class {
    add = add;
    getRepeatableJobs = getRepeatableJobs;
    removeRepeatableByKey = removeRepeatableByKey;
  },
  QueueEvents: class {},
}));
vi.mock('../../config/env', () => ({
  env: {
    BULL_PREFIX: 't',
    FEED_SYNC_CRON: '17 * * * *',
    SCRAPER_MAX_RETRIES: 1,
    SCRAPER_BACKOFF_MS: 1,
  },
}));
vi.mock('../../config/redis', () => ({ redis: {} }));

import { enqueueFeedSyncForced, enqueueFeedSyncNow, scheduleFeedSync } from './queues';

const jobIdOf = (call: unknown[]) => (call[2] as { jobId?: string } | undefined)?.jobId;

describe('feed sync enqueueing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getRepeatableJobs.mockResolvedValue([]);
  });

  it('dedupes startup syncs within the same hour so cold starts do not re-hit the feeds', async () => {
    const t = Date.parse('2026-11-25T10:05:00Z');
    await enqueueFeedSyncNow(t);
    await enqueueFeedSyncNow(t + 40 * 60 * 1000);
    await enqueueFeedSyncNow(t + 2 * 60 * 60 * 1000);
    const ids = add.mock.calls.map(jobIdOf);
    expect(ids[0]).toBeDefined();
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it('lets an admin force a sync regardless of the interval', async () => {
    await enqueueFeedSyncForced();
    expect(jobIdOf(add.mock.calls[0]!)).toBeUndefined();
  });

  it('schedules hourly off the top of the hour and removes stale schedules', async () => {
    getRepeatableJobs.mockResolvedValue([
      { key: 'old-every-6h', pattern: null, every: '21600000' },
      { key: 'current', pattern: '17 * * * *' },
    ]);
    await scheduleFeedSync();
    expect(removeRepeatableByKey).toHaveBeenCalledWith('old-every-6h');
    expect(removeRepeatableByKey).not.toHaveBeenCalledWith('current');
    expect(add).toHaveBeenCalledWith(
      'sync',
      {},
      expect.objectContaining({ repeat: { pattern: '17 * * * *' } }),
    );
  });
});
