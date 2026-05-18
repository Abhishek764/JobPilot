import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { jobRepository } from '../../jobs/job.repository';
import { scrapeRunRepository } from '../../scraper/scrape-run.repository';
import type { NormalizeJob } from '../queues';

export const createNormalizeWorker = (): Worker<NormalizeJob> => {
  const worker = new Worker<NormalizeJob>(
    'scrape-normalize',
    async (job) => {
      const { runId, normalized } = job.data;
      const { created } = await jobRepository.upsertNormalized(normalized);
      await scrapeRunRepository.incrementCounts(runId, {
        jobsNew: created ? 1 : 0,
        jobsUpdated: created ? 0 : 1,
      });
      return { created };
    },
    {
      connection: redis,
      prefix: env.BULL_PREFIX,
      concurrency: env.SCRAPER_NORMALIZE_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error({ id: job?.id, err: err.message }, 'normalize job failed'),
  );
  return worker;
};
