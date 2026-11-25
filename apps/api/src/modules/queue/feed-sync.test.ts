import { beforeEach, describe, expect, it, vi } from 'vitest';

const add = vi.hoisted(() => vi.fn());
vi.mock('bullmq', () => ({
  Queue: class {
    add = add;
  },
  QueueEvents: class {},
}));
vi.mock('../../config/env', () => ({
  env: {
    BULL_PREFIX: 't',
    FEED_SYNC_INTERVAL_HOURS: 6,
    SCRAPER_MAX_RETRIES: 1,
    SCRAPER_BACKOFF_MS: 1,
  },
}));
vi.mock('../../config/redis', () => ({ redis: {} }));

import { enqueueFeedSyncForced, enqueueFeedSyncNow } from './queues';

const jobIdOf = (call: unknown[]) => (call[2] as { jobId?: string } | undefined)?.jobId;

describe('feed sync enqueueing', () => {
  beforeEach(() => add.mockReset());

  it('dedupes startup syncs within one interval so cold starts do not re-hit the feeds', async () => {
    const t = Date.parse('2026-11-25T01:00:00Z');
    await enqueueFeedSyncNow(t);
    await enqueueFeedSyncNow(t + 60 * 60 * 1000);
    await enqueueFeedSyncNow(t + 7 * 60 * 60 * 1000);
    const ids = add.mock.calls.map(jobIdOf);
    expect(ids[0]).toBeDefined();
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it('lets an admin force a sync regardless of the interval', async () => {
    await enqueueFeedSyncForced();
    expect(jobIdOf(add.mock.calls[0]!)).toBeUndefined();
  });
});
