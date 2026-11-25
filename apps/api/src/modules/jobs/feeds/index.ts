import type { NormalizedJob, SourcePlatform } from '@jobpilot/types';
import { NormalizedJobSchema } from '@jobpilot/types/schemas';

import { logger } from '../../../config/logger';
import { normalizeRaw } from '../../scraper/core/normalizer';
import type { RawJob } from '../../scraper/core/types';
import { jobRepository } from '../job.repository';

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

export const parseRemotive = (json: unknown): NormalizedJob[] =>
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

export const parseArbeitnow = (json: unknown): NormalizedJob[] =>
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

/**
 * Public job-board APIs. Both ask that listings link back to them and name
 * them as the source, which `url`/`applyUrl` and `source` do.
 */
const FEEDS: {
  platform: SourcePlatform;
  url: string;
  parse: (json: unknown) => NormalizedJob[];
}[] = [
  { platform: 'REMOTIVE', url: 'https://remotive.com/api/remote-jobs', parse: parseRemotive },
  {
    platform: 'ARBEITNOW',
    url: 'https://www.arbeitnow.com/api/job-board-api',
    parse: parseArbeitnow,
  },
];

export interface FeedSyncResult {
  platform: SourcePlatform;
  fetched: number;
  upserted: number;
  error?: string;
}

/** Pull every feed and upsert its jobs. A failing feed is reported and never removes existing jobs. */
export const syncFeeds = async (fetchImpl: typeof fetch = fetch): Promise<FeedSyncResult[]> => {
  const results: FeedSyncResult[] = [];
  for (const feed of FEEDS) {
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
        await jobRepository.upsertNormalized(job);
        upserted++;
      }
      results.push({ platform: feed.platform, fetched: jobs.length, upserted });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.warn({ platform: feed.platform, err: error }, 'job feed sync failed');
      results.push({ platform: feed.platform, fetched: 0, upserted: 0, error });
    }
  }
  logger.info({ results }, 'job feeds synced');
  return results;
};
