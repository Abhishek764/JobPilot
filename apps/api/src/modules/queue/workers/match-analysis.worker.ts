import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { matchService } from '../../ai/match.service';
import type { MatchAnalysisJob } from '../queues';

export const createMatchAnalysisWorker = (): Worker<MatchAnalysisJob> => {
  const worker = new Worker<MatchAnalysisJob>(
    'ai-match',
    async (job) => {
      const result = await matchService.processAnalysis(job.data.analysisId);
      return {
        id: result.id,
        status: result.status,
        compatibility: result.compatibility,
        cacheHit: result.cacheHit,
      };
    },
    {
      connection: redis,
      prefix: env.BULL_PREFIX,
      concurrency: env.AI_MATCH_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error(
      { id: job?.id, analysisId: job?.data.analysisId, err: err.message, attempts: job?.attemptsMade },
      'match analysis job failed',
    ),
  );
  worker.on('completed', (job) =>
    logger.info({ id: job.id, analysisId: job.data.analysisId }, 'match analysis completed'),
  );
  return worker;
};
