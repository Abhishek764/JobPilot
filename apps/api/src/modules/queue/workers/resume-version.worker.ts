import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { versionService } from '../../resume/version.service';
import type { ResumeVersionJob } from '../queues';

export const createResumeVersionWorker = (): Worker<ResumeVersionJob> => {
  const worker = new Worker<ResumeVersionJob>(
    'resume-version',
    async (job) => {
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const version = await versionService.process(job.data.versionId, { finalAttempt });
      return { id: version.id, status: version.status };
    },
    { connection: redis, prefix: env.BULL_PREFIX, concurrency: env.RESUME_AI_CONCURRENCY },
  );
  worker.on('failed', (job, err) =>
    logger.error({ versionId: job?.data.versionId, err: err.message }, 'resume version job failed'),
  );
  return worker;
};
