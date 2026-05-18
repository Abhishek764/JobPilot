import type { Worker } from 'bullmq';

import { env } from '../../config/env';
import { logger } from '../../config/logger';

import { createNormalizeWorker } from './workers/normalize.worker';
import { createSchedulerWorker } from './workers/scheduler.worker';
import { createScrapeDetailWorker } from './workers/scrape-detail.worker';
import { createScrapeListingWorker } from './workers/scrape-listing.worker';

export * from './queues';
export * from './scheduler';

export const startAllWorkers = (): Worker[] => {
  const workers: Worker[] = [
    createScrapeListingWorker(),
    createScrapeDetailWorker(),
    createNormalizeWorker(),
  ];
  if (env.SCRAPER_SCHEDULER_ENABLED) {
    workers.push(createSchedulerWorker());
    logger.info('scheduler worker enabled');
  }
  return workers;
};

export const stopWorkers = async (workers: Worker[]): Promise<void> => {
  await Promise.allSettled(workers.map((w) => w.close()));
};
