import type { Worker } from 'bullmq';

import { env } from './config/env';
import { logger } from './config/logger';
import {
  enqueueFeedSyncNow,
  scheduleFeedSync,
  startAllWorkers,
  syncScheduledSources,
} from './modules/queue';
import { registerScrapers } from './modules/scraper/sources';

/**
 * Start BullMQ workers and recurring schedules. Used by the dedicated worker
 * process and, on single-instance hosting (RUN_WORKERS=true), by the API itself.
 */
export const startBackground = async (): Promise<Worker[]> => {
  registerScrapers();
  const workers = startAllWorkers();

  if (env.SCRAPER_SCHEDULER_ENABLED) {
    await syncScheduledSources().catch((err) =>
      logger.error({ err }, 'initial scheduler sync failed'),
    );
  }
  if (env.FEEDS_ENABLED) {
    // Repeat on an interval, plus one run now so a fresh deploy has jobs immediately.
    await Promise.all([scheduleFeedSync(), enqueueFeedSyncNow()]).catch((err) =>
      logger.error({ err }, 'feed sync scheduling failed'),
    );
  }

  logger.info(
    {
      count: workers.length,
      schedulerEnabled: env.SCRAPER_SCHEDULER_ENABLED,
      feedsEnabled: env.FEEDS_ENABLED,
    },
    'workers started',
  );
  return workers;
};
