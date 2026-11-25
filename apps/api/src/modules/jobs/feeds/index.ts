import type { NormalizedJob, SourcePlatform } from '@jobpilot/types';
import { NormalizedJobSchema } from '@jobpilot/types/schemas';

import { logger } from '../../../config/logger';
import { normalizeRaw } from '../../scraper/core/normalizer';
import type { RawJob } from '../../scraper/core/types';
import { isFresherJob } from '../fresher';
import { jobRepository } from '../job.repository';

import type { LastRunStore } from './last-run';

/** A normalized job plus whether its source labels it entry-level. */
export type FeedJob = NormalizedJob & { sourceIsEntryLevel?: boolean };

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });

/** Job descriptions arrive as (sometimes double-encoded) HTML; store readable plain text. */
export const htmlToText = (html: string): string => {
  let s = html;
  // Arbeitnow double-encodes its markup; decode until stable (bounded).
  for (let i = 0; i < 3 && /&(lt|gt|amp|quot|#\d+);/i.test(s); i++) s = decodeEntities(s);
  return decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Normalize via the scraper pipeline, then drop anything that fails the shared schema. */
const toJob = (
  raw: RawJob | null,
  platform: SourcePlatform,
  source: string,
): NormalizedJob | null => {
  if (!raw) return null;
  const job = { ...normalizeRaw(raw, platform), source };
  const parsed = NormalizedJobSchema.safeParse(job);
  return parsed.success ? (parsed.data as NormalizedJob) : null;
};

const rows = (json: unknown, key: string): Record<string, unknown>[] => {
  const list = (json as Record<string, unknown> | null)?.[key];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
};

export const parseRemotive = (json: unknown): FeedJob[] =>
  rows(json, 'jobs')
    .map((r) => {
      const title = str(r.title);
      const company = str(r.company_name);
      const url = str(r.url);
      if (!title || !company || !url) return null;
      const published = str(r.publication_date);
      return toJob(
        {
          url,
          externalId: r.id != null ? String(r.id) : null,
          title,
          company,
          location: str(r.candidate_required_location),
          description: str(r.description) ? htmlToText(r.description as string) : null,
          applyUrl: url,
          // Remotive timestamps are UTC without a zone suffix.
          postedAtText: published ? `${published}Z` : null,
          salaryText: str(r.salary),
          skillsText: Array.isArray(r.tags)
            ? r.tags.filter((t): t is string => typeof t === 'string')
            : [],
          roleCategoryText: null,
          remote: true,
        },
        'REMOTIVE',
        'remotive.com',
      );
    })
    .filter((j): j is NormalizedJob => j !== null);

export const parseArbeitnow = (json: unknown): FeedJob[] =>
  rows(json, 'data')
    .map((r) => {
      const title = str(r.title);
      const company = str(r.company_name);
      const url = str(r.url);
      if (!title || !company || !url) return null;
      const created = typeof r.created_at === 'number' ? new Date(r.created_at * 1000) : null;
      return toJob(
        {
          url,
          externalId: str(r.slug),
          title,
          company,
          location: str(r.location),
          description: str(r.description) ? htmlToText(r.description as string) : null,
          applyUrl: url,
          postedAtText: created ? created.toISOString() : null,
          salaryText: null,
          skillsText: Array.isArray(r.tags)
            ? r.tags.filter((t): t is string => typeof t === 'string')
            : [],
          roleCategoryText: null,
          remote: r.remote === true,
        },
        'ARBEITNOW',
        'arbeitnow.com',
      );
    })
    .filter((j): j is NormalizedJob => j !== null);

export const parseJobicy = (json: unknown): FeedJob[] =>
  rows(json, 'jobs')
    .map((r): FeedJob | null => {
      const title = str(r.jobTitle);
      const company = str(r.companyName);
      const url = str(r.url);
      if (!title || !company || !url) return null;
      const job = toJob(
        {
          url,
          externalId: r.id != null ? String(r.id) : null,
          title,
          company,
          location: str(r.jobGeo),
          description: str(r.jobDescription) ? htmlToText(r.jobDescription as string) : null,
          applyUrl: url,
          postedAtText: str(r.pubDate),
          salaryText: null,
          skillsText: Array.isArray(r.jobIndustry)
            ? r.jobIndustry.filter((t): t is string => typeof t === 'string')
            : [],
          roleCategoryText: null,
          remote: true,
        },
        'JOBICY',
        'jobicy.com',
      );
      // Jobicy labels level e.g. "Entry-Level, Junior", "Midweight", "Senior", "Any".
      return job && { ...job, sourceIsEntryLevel: /entry|junior/i.test(str(r.jobLevel) ?? '') };
    })
    .filter((j): j is FeedJob => j !== null);

const HOUR = 3_600_000;

/**
 * Public job-board APIs. Each asks that listings credit it and link back to the original
 * posting, which `source` and `url`/`applyUrl` do. `minIntervalHours` respects each
 * provider's polling guidance: Remotive asks for a few calls a day, Jobicy and Arbeitnow
 * allow hourly passes.
 */
const FEEDS: {
  platform: SourcePlatform;
  url: string;
  minIntervalHours: number;
  parse: (json: unknown) => FeedJob[];
}[] = [
  {
    platform: 'REMOTIVE',
    url: 'https://remotive.com/api/remote-jobs',
    minIntervalHours: 6,
    parse: parseRemotive,
  },
  {
    platform: 'ARBEITNOW',
    url: 'https://www.arbeitnow.com/api/job-board-api',
    minIntervalHours: 1,
    parse: parseArbeitnow,
  },
  {
    platform: 'JOBICY',
    url: 'https://jobicy.com/api/jobs?count=100',
    minIntervalHours: 1,
    parse: parseJobicy,
  },
];

export interface FeedSyncResult {
  platform: SourcePlatform;
  fetched: number;
  upserted: number;
  /** Fetched but dropped by the fresher filter. */
  filtered: number;
  skipped?: 'not due';
  error?: string;
}

export interface SyncFeedsOptions {
  fetchImpl?: typeof fetch;
  lastRun?: LastRunStore;
  now?: number;
}

/**
 * Pull every due feed, store fresher jobs only, then re-screen stored jobs so anything
 * no longer matching (e.g. senior roles from older syncs) is deactivated. A failing feed is
 * reported, not recorded as run, and never removes existing jobs.
 */
export const syncFeeds = async (opts: SyncFeedsOptions = {}): Promise<FeedSyncResult[]> => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const lastRun = opts.lastRun ?? (await import('./last-run')).redisLastRun;
  const now = opts.now ?? Date.now();
  const results: FeedSyncResult[] = [];

  for (const feed of FEEDS) {
    const empty = { platform: feed.platform, fetched: 0, upserted: 0, filtered: 0 };
    // Small slack so an hourly cron isn't skipped by a few seconds of drift.
    const last = await lastRun.get(feed.platform);
    if (last !== null && now - last < feed.minIntervalHours * HOUR - 5 * 60_000) {
      results.push({ ...empty, skipped: 'not due' });
      continue;
    }
    try {
      const res = await fetchImpl(feed.url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'JobPilotAI/1.0 (+job search for students)',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const jobs = feed.parse(await res.json());
      let upserted = 0;
      for (const job of jobs) {
        if (!isFresherJob(job, { sourceIsEntryLevel: job.sourceIsEntryLevel })) continue;
        await jobRepository.upsertNormalized(job);
        upserted++;
      }
      await lastRun.set(feed.platform, now);
      results.push({ ...empty, fetched: jobs.length, upserted, filtered: jobs.length - upserted });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.warn({ platform: feed.platform, err: error }, 'job feed sync failed');
      results.push({ ...empty, error });
    }
  }

  const deactivated = await jobRepository.screenStoredJobs();
  logger.info({ results, deactivated }, 'job feeds synced');
  return results;
};
