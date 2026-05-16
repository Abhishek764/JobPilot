import { Queue, Worker, type JobsOptions } from 'bullmq';

import { logger } from '../../config/logger';
import { redis } from '../../config/redis';

const connection = redis;

export const scrapeQueue = new Queue('scrape', { connection });

export const enqueueScrape = (url: string, opts?: JobsOptions) =>
  scrapeQueue.add('scrape-job', { url }, { removeOnComplete: 100, removeOnFail: 500, ...opts });

export const startWorkers = async (): Promise<Worker> => {
  const { scraperService } = await import('../scraper/scraper.service');

  const worker = new Worker(
    'scrape',
    async (job) => {
      const { url } = job.data as { url: string };
      return scraperService.scrapeAndStore(url);
    },
    { connection, concurrency: 2 },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'scrape job done'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'scrape job failed'));

  return worker;
};
