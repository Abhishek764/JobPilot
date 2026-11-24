import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { coverLetterService } from '../../resume/cover-letter.service';
import type { CoverLetterJob } from '../queues';

export const createCoverLetterWorker = (): Worker<CoverLetterJob> => {
  const worker = new Worker<CoverLetterJob>(
    'resume-cover',
    async (job) => {
      const letter = await coverLetterService.process(job.data.coverLetterId);
      return { id: letter.id, status: letter.status };
    },
    { connection: redis, prefix: env.BULL_PREFIX, concurrency: env.RESUME_AI_CONCURRENCY },
  );
  worker.on('failed', (job, err) =>
    logger.error(
      { coverLetterId: job?.data.coverLetterId, err: err.message },
      'cover letter job failed',
    ),
  );
  return worker;
};
