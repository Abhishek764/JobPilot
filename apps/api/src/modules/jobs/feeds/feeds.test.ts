import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ upsertNormalized: vi.fn() }));
vi.mock('../job.repository', () => ({ jobRepository: repo }));
vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { htmlToText, parseArbeitnow, parseRemotive, syncFeeds } from './index';

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

describe('syncFeeds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.upsertNormalized.mockResolvedValue({ job: {}, created: true });
  });

  it('keeps syncing other feeds when one source fails', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('remotive')) throw new Error('timeout');
      return new Response(JSON.stringify({ data: [arbeitnowRow] }), { status: 200 });
    });
    const results = await syncFeeds(fetchImpl as unknown as typeof fetch);
    expect(results).toEqual([
      { platform: 'REMOTIVE', fetched: 0, upserted: 0, error: 'timeout' },
      { platform: 'ARBEITNOW', fetched: 1, upserted: 1 },
    ]);
    expect(repo.upsertNormalized).toHaveBeenCalledTimes(1);
  });

  it('reports a non-OK HTTP response as a failure', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));
    const results = await syncFeeds(fetchImpl as unknown as typeof fetch);
    expect(results.every((r) => r.error === 'HTTP 503')).toBe(true);
    expect(repo.upsertNormalized).not.toHaveBeenCalled();
  });
});
