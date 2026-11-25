import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { analysisService } from '../../resume/analysis.service';
import type { ResumeAnalysisJob } from '../queues';

export const createResumeAnalysisWorker = (): Worker<ResumeAnalysisJob> => {
  const worker = new Worker<ResumeAnalysisJob>(
    'resume-analyze',
    async (job) => {
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const analysis = await analysisService.process(job.data.analysisId, { finalAttempt });
      return { id: analysis.id, status: analysis.status };
    },
    { connection: redis, prefix: env.BULL_PREFIX, concurrency: env.RESUME_AI_CONCURRENCY },
  );
  worker.on('failed', (job, err) =>
    logger.error(
      { analysisId: job?.data.analysisId, err: err.message },
      'resume analysis job failed',
    ),
  );
  return worker;
};
