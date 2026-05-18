import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { fanOutScheduledRun } from '../scheduler';

export const createSchedulerWorker = (): Worker<{ sourceId: string }> => {
  const worker = new Worker<{ sourceId: string }>(
    'scrape-scheduler',
    async (job) => {
      const { sourceId } = job.data;
      logger.info({ sourceId }, 'scheduler tick');
      await fanOutScheduledRun(sourceId);
    },
    { connection: redis, prefix: env.BULL_PREFIX, concurrency: 2 },
  );
  worker.on('failed', (job, err) => logger.error({ id: job?.id, err: err.message }, 'scheduler failed'));
  return worker;
};
