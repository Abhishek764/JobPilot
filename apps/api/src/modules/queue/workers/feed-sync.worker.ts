import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { syncFeeds } from '../../jobs/feeds';

export const createFeedSyncWorker = (): Worker => {
  const worker = new Worker('feed-sync', async () => syncFeeds(), {
    connection: redis,
    prefix: env.BULL_PREFIX,
    concurrency: 1,
  });
  worker.on('failed', (_job, err) => logger.error({ err: err.message }, 'feed sync job failed'));
  return worker;
};
