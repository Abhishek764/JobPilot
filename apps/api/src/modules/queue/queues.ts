import type { NormalizedJob, SourcePlatform } from '@jobpilot/types';
import { Queue, QueueEvents, type JobsOptions } from 'bullmq';

import { env } from '../../config/env';
import { redis } from '../../config/redis';

const connection = redis;
const prefix = env.BULL_PREFIX;

export interface ScrapeListingJob {
  runId: string;
  platform: SourcePlatform;
  query?: string;
  location?: string;
  page: number;
  maxPages: number;
}

export interface ScrapeDetailJob {
  runId: string;
  platform: SourcePlatform;
  url: string;
}

export interface NormalizeJob {
  runId: string;
  platform: SourcePlatform;
  normalized: NormalizedJob;
}

const defaultJobOpts: JobsOptions = {
  attempts: env.SCRAPER_MAX_RETRIES,
  backoff: { type: 'exponential', delay: env.SCRAPER_BACKOFF_MS },
  removeOnComplete: { age: 24 * 3_600, count: 5_000 },
  removeOnFail: { age: 7 * 24 * 3_600, count: 10_000 },
};

export const scrapeListingQueue = new Queue<ScrapeListingJob>('scrape-listing', {
  connection,
  prefix,
  defaultJobOptions: defaultJobOpts,
});

export const scrapeDetailQueue = new Queue<ScrapeDetailJob>('scrape-detail', {
  connection,
  prefix,
  defaultJobOptions: defaultJobOpts,
});

export const normalizeQueue = new Queue<NormalizeJob>('scrape-normalize', {
  connection,
  prefix,
  defaultJobOptions: {
    ...defaultJobOpts,
    attempts: 3,
  },
});

export const scrapeListingEvents = new QueueEvents('scrape-listing', { connection, prefix });
export const scrapeDetailEvents = new QueueEvents('scrape-detail', { connection, prefix });
export const normalizeEvents = new QueueEvents('scrape-normalize', { connection, prefix });

/** Back-compat: single-URL adhoc scrape (kept for /scrape/jobs). */
export const scrapeQueue = new Queue('scrape', {
  connection,
  prefix,
  defaultJobOptions: defaultJobOpts,
});

export const enqueueScrape = (url: string, opts?: JobsOptions) =>
  scrapeQueue.add('scrape-job', { url }, opts);

export const enqueueListing = (data: ScrapeListingJob) =>
  scrapeListingQueue.add(`listing:${data.platform}:p${data.page}`, data, {
    jobId: `${data.runId}:listing:${data.page}`,
  });

export const enqueueDetail = (data: ScrapeDetailJob) =>
  scrapeDetailQueue.add(`detail:${data.platform}`, data, {
    jobId: `${data.runId}:${Buffer.from(data.url).toString('base64url').slice(0, 40)}`,
  });

export const enqueueNormalize = (data: NormalizeJob) =>
  normalizeQueue.add(`normalize:${data.platform}`, data);
