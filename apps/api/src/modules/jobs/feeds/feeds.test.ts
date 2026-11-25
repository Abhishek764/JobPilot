import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ upsertNormalized: vi.fn(), screenStoredJobs: vi.fn() }));
vi.mock('../job.repository', () => ({ jobRepository: repo }));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { htmlToText, parseArbeitnow, parseJobicy, parseRemotive, syncFeeds } from './index';

const remotiveRow = {
  id: 2091177,
  url: 'https://remotive.com/remote-jobs/software-dev/frontend-intern-2091177',
  title: 'Frontend Intern',
  company_name: 'Acme',
  category: 'Software Development',
  tags: ['React', 'AWS'],
  job_type: 'internship',
  publication_date: '2026-11-19T14:58:42',
  candidate_required_location: 'Worldwide',
  salary: '$20/hour',
  description: '<p>Build <strong>React</strong> UIs.</p><ul><li>TypeScript</li></ul>',
};

const arbeitnowRow = {
  slug: 'junior-dev-acme-1',
  company_name: 'Beta GmbH',
  title: 'Junior Developer',
  description: '&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;',
  remote: false,
  url: 'https://www.arbeitnow.com/jobs/companies/beta/junior-dev-acme-1',
  tags: ['Python'],
  job_types: ['full time'],
  location: 'Berlin',
  created_at: 1795568115,
};

describe('htmlToText', () => {
  it('strips tags and decodes (double-)encoded entities into readable text', () => {
    expect(htmlToText('&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;')).toBe('Hello & welcome');
    expect(htmlToText('<p>One</p><p>Two&nbsp;&#39;x&#39;</p>')).toBe("One\n\nTwo 'x'");
  });
});

describe('parseRemotive', () => {
  it('maps a listing to a normalized remote job that links back to Remotive', () => {
    const [job] = parseRemotive({ jobs: [remotiveRow] });
    expect(job).toMatchObject({
      externalId: '2091177',
      sourcePlatform: 'REMOTIVE',
      source: 'remotive.com',
      url: remotiveRow.url,
      applyUrl: remotiveRow.url,
      title: 'Frontend Intern',
      company: 'Acme',
      location: 'Worldwide',
      remote: true,
      description: 'Build React UIs.\n\nTypeScript',
    });
    expect(job!.skills).toEqual(expect.arrayContaining(['react', 'aws', 'typescript']));
    expect(job!.postedAt).toEqual(new Date('2026-11-19T14:58:42Z'));
  });

  it('skips rows missing a title, company or url', () => {
    const rows = [
      { ...remotiveRow, title: '' },
      { ...remotiveRow, company_name: undefined },
      { ...remotiveRow, url: 'not a url' },
    ];
    expect(parseRemotive({ jobs: rows })).toEqual([]);
    expect(parseRemotive({ nope: true })).toEqual([]);
  });
});

describe('parseArbeitnow', () => {
  it('maps a listing and decodes its description', () => {
    const [job] = parseArbeitnow({ data: [arbeitnowRow] });
    expect(job).toMatchObject({
      externalId: 'junior-dev-acme-1',
      sourcePlatform: 'ARBEITNOW',
      source: 'arbeitnow.com',
      location: 'Berlin',
      remote: false,
      description: 'Hello & welcome',
    });
    expect(job!.postedAt).toEqual(new Date(1795568115 * 1000));
  });
});

const jobicyRow = {
  id: 157023,
  url: 'https://jobicy.com/jobs/157023-junior-data-analyst',
  jobTitle: 'Data Analyst',
  companyName: 'Toptal',
  jobIndustry: ['Data Science'],
  jobGeo: 'Canada',
  jobLevel: 'Entry-Level, Junior',
  jobDescription: '<p>Analyse product data with SQL.</p>',
  pubDate: '2026-11-25T03:30:59+00:00',
};

describe('parseJobicy', () => {
  it('maps a listing, links back to Jobicy and carries its entry-level flag', () => {
    const [job] = parseJobicy({ jobs: [jobicyRow] });
    expect(job).toMatchObject({
      externalId: '157023',
      sourcePlatform: 'JOBICY',
      source: 'jobicy.com',
      url: jobicyRow.url,
      applyUrl: jobicyRow.url,
      title: 'Data Analyst',
      company: 'Toptal',
      location: 'Canada',
      remote: true,
      description: 'Analyse product data with SQL.',
      sourceIsEntryLevel: true,
    });
    expect(
      parseJobicy({ jobs: [{ ...jobicyRow, jobLevel: 'Senior' }] })[0]?.sourceIsEntryLevel,
    ).toBe(false);
  });
});

/** In-memory last-run store so tests control which feeds are due. */
const memoryStore = (initial: Record<string, number> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: vi.fn(async (platform: string) => data.get(platform) ?? null),
    set: vi.fn(async (platform: string, at: number) => void data.set(platform, at)),
  };
};

const okFetch = () =>
  vi.fn(async (url: string) => {
    if (url.includes('remotive')) {
      return new Response(
        JSON.stringify({
          jobs: [
            remotiveRow,
            {
              ...remotiveRow,
              id: 2,
              url: 'https://remotive.com/x/2',
              title: 'Senior Staff Engineer',
            },
          ],
        }),
      );
    }
    if (url.includes('arbeitnow')) return new Response(JSON.stringify({ data: [arbeitnowRow] }));
    return new Response(JSON.stringify({ jobs: [jobicyRow] }));
  });

describe('syncFeeds', () => {
  const NOW = Date.parse('2026-11-25T12:17:00Z');

  beforeEach(() => {
    vi.resetAllMocks();
    repo.upsertNormalized.mockResolvedValue({ job: {}, created: true });
    repo.screenStoredJobs.mockResolvedValue(3);
  });

  it('stores fresher jobs only and re-screens stored jobs', async () => {
    const lastRun = memoryStore();
    const results = await syncFeeds({
      fetchImpl: okFetch() as unknown as typeof fetch,
      lastRun,
      now: NOW,
    });
    expect(results).toEqual([
      { platform: 'REMOTIVE', fetched: 2, upserted: 1, filtered: 1 },
      { platform: 'ARBEITNOW', fetched: 1, upserted: 1, filtered: 0 },
      { platform: 'JOBICY', fetched: 1, upserted: 1, filtered: 0 },
    ]);
    const titles = repo.upsertNormalized.mock.calls.map(([j]) => j.title);
    expect(titles).not.toContain('Senior Staff Engineer');
    expect(repo.screenStoredJobs).toHaveBeenCalledTimes(1);
    expect(lastRun.data.get('REMOTIVE')).toBe(NOW);
  });

  it('calls Remotive at most every 6 hours while other feeds run hourly', async () => {
    const twoHoursAgo = NOW - 2 * 3_600_000;
    const lastRun = memoryStore({
      REMOTIVE: twoHoursAgo,
      ARBEITNOW: twoHoursAgo,
      JOBICY: twoHoursAgo,
    });
    const fetchImpl = okFetch();
    const results = await syncFeeds({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lastRun,
      now: NOW,
    });
    expect(results[0]).toEqual({
      platform: 'REMOTIVE',
      fetched: 0,
      upserted: 0,
      filtered: 0,
      skipped: 'not due',
    });
    expect(fetchImpl.mock.calls.some(([u]) => String(u).includes('remotive'))).toBe(false);
    expect(lastRun.data.get('REMOTIVE')).toBe(twoHoursAgo);
    expect(results[1]?.upserted).toBe(1);
  });

  it('keeps syncing other feeds when one source fails, without recording it as run', async () => {
    const lastRun = memoryStore();
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('remotive')) throw new Error('timeout');
      return okFetch()(url);
    });
    const results = await syncFeeds({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lastRun,
      now: NOW,
    });
    expect(results[0]).toEqual({
      platform: 'REMOTIVE',
      fetched: 0,
      upserted: 0,
      filtered: 0,
      error: 'timeout',
    });
    expect(lastRun.data.has('REMOTIVE')).toBe(false);
    expect(results[1]?.upserted).toBe(1);
  });

  it('reports a non-OK HTTP response as a failure', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));
    const results = await syncFeeds({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lastRun: memoryStore(),
      now: NOW,
    });
    expect(results.every((r) => r.error === 'HTTP 503')).toBe(true);
    expect(repo.upsertNormalized).not.toHaveBeenCalled();
  });
});
