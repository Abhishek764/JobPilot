import { createHash } from 'node:crypto';

import { redis } from '../../../config/redis';
import type { NormalizedJob } from '@jobpilot/types';

/**
 * Two-layer dedup:
 *  - Bloom-ish Redis SETNX on canonical URL → skips work before scraping.
 *  - Stable contentHash from (platform|company|title|location) → DB-level UNIQUE.
 */

export const canonicalizeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    u.hash = '';
    const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'refId', 'trk', 'src'];
    drop.forEach((p) => u.searchParams.delete(p));
    u.searchParams.sort();
    let pathname = u.pathname.replace(/\/+$/, '');
    if (pathname === '') pathname = '/';
    return `${u.protocol}//${u.hostname.toLowerCase()}${pathname}${u.search}`;
  } catch {
    return url;
  }
};

export const contentHash = (
  job: Pick<NormalizedJob, 'sourcePlatform' | 'company' | 'title' | 'location' | 'externalId' | 'url'>,
): string => {
  const key = [
    job.sourcePlatform,
    job.externalId ?? canonicalizeUrl(job.url),
    job.company.trim().toLowerCase(),
    job.title.trim().toLowerCase(),
    (job.location ?? '').trim().toLowerCase(),
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
};

/**
 * Reserve a URL for processing in this run window. TTL bounds memory; if a URL
 * legitimately needs re-scrape (e.g., daily refresh) it falls through after TTL.
 */
export const reserveUrl = async (url: string, ttlSec = 6 * 60 * 60): Promise<boolean> => {
  const key = `scrape:seen:${canonicalizeUrl(url)}`;
  const res = await redis.set(key, '1', 'EX', ttlSec, 'NX');
  return res === 'OK';
};
