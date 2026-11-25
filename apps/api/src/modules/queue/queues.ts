import type { MatchTrack } from '@jobpilot/db';
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

export interface MatchAnalysisJob {
  analysisId: string;
  userId: string;
  track: MatchTrack;
}

export const matchAnalysisQueue = new Queue<MatchAnalysisJob>('ai-match', {
  connection,
  prefix,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { age: 24 * 3_600, count: 1_000 },
    removeOnFail: { age: 7 * 24 * 3_600, count: 1_000 },
  },
});

export const matchAnalysisEvents = new QueueEvents('ai-match', { connection, prefix });

export const enqueueMatchAnalysis = (data: MatchAnalysisJob) =>
  matchAnalysisQueue.add(`match:${data.track}`, data, { jobId: data.analysisId });

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

// ── Resume optimization pipeline ────────────────────────────────────────────

const resumeJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 24 * 3_600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3_600, count: 1_000 },
};

export interface ResumeParseJob {
  resumeId: string;
}
export interface ResumeAnalysisJob {
  analysisId: string;
}
export interface ResumeVersionJob {
  versionId: string;
}
export interface CoverLetterJob {
  coverLetterId: string;
}

export const resumeParseQueue = new Queue<ResumeParseJob>('resume-parse', {
  connection,
  prefix,
  defaultJobOptions: resumeJobOpts,
});
export const resumeAnalysisQueue = new Queue<ResumeAnalysisJob>('resume-analyze', {
  connection,
  prefix,
  defaultJobOptions: resumeJobOpts,
});
export const resumeVersionQueue = new Queue<ResumeVersionJob>('resume-version', {
  connection,
  prefix,
  defaultJobOptions: resumeJobOpts,
});
export const coverLetterQueue = new Queue<CoverLetterJob>('resume-cover', {
  connection,
  prefix,
  defaultJobOptions: resumeJobOpts,
});

// Per-attempt id: a retained failed job with a fixed id would make BullMQ drop a retry.
// The parser short-circuits PARSED resumes, so duplicate attempts are harmless.
export const enqueueResumeParse = (data: ResumeParseJob) =>
  resumeParseQueue.add('parse', data, { jobId: `parse:${data.resumeId}:${Date.now()}` });
export const enqueueResumeAnalysis = (data: ResumeAnalysisJob) =>
  resumeAnalysisQueue.add('analyze', data, { jobId: data.analysisId });
export const enqueueResumeVersion = (data: ResumeVersionJob) =>
  resumeVersionQueue.add('version', data, { jobId: data.versionId });
export const enqueueCoverLetter = (data: CoverLetterJob) =>
  coverLetterQueue.add('cover', data, { jobId: data.coverLetterId });

// ── Public job-board feeds ──────────────────────────────────────────────────

export const feedSyncQueue = new Queue('feed-sync', {
  connection,
  prefix,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Run the feed sync on FEED_SYNC_CRON (default hourly at :17 — Jobicy asks clients to avoid
 * minute :00). Older schedules with a different pattern or interval are removed first so a
 * config change never leaves two schedules running. Per-feed limits live in syncFeeds.
 */
export const scheduleFeedSync = async () => {
  for (const r of await feedSyncQueue.getRepeatableJobs()) {
    if (r.pattern !== env.FEED_SYNC_CRON) await feedSyncQueue.removeRepeatableByKey(r.key);
  }
  return feedSyncQueue.add(
    'sync',
    {},
    { repeat: { pattern: env.FEED_SYNC_CRON }, jobId: 'feed-sync-repeat' },
  );
};

/**
 * Sync at startup at most once per hour: free hosts sleep and wake often. The jobId
 * dedupes wakes inside the same hour.
 */
export const enqueueFeedSyncNow = (now: number = Date.now()) => {
  const bucket = Math.floor(now / 3_600_000);
  return feedSyncQueue.add('sync-now', {}, { jobId: `feed-sync-now-${bucket}` });
};

/** Admin-triggered sync that bypasses the interval dedupe. */
export const enqueueFeedSyncForced = () => feedSyncQueue.add('sync-forced', {});
