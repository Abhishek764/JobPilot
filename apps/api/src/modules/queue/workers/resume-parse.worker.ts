import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { processResumeParse } from '../../resume/resume.parser';
import type { ResumeParseJob } from '../queues';

export const createResumeParseWorker = (): Worker<ResumeParseJob> => {
  const worker = new Worker<ResumeParseJob>(
    'resume-parse',
    async (job) => {
      const resume = await processResumeParse(job.data.resumeId);
      return { id: resume.id, fileStatus: resume.fileStatus };
    },
    { connection: redis, prefix: env.BULL_PREFIX, concurrency: env.RESUME_PARSE_CONCURRENCY },
  );

  worker.on('failed', (job, err) =>
    logger.error({ resumeId: job?.data.resumeId, err: err.message }, 'resume parse failed'),
  );
  return worker;
};
