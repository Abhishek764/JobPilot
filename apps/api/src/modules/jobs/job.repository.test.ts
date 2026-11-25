import { ListJobsQuerySchema } from '@jobpilot/types/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  job: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('@jobpilot/db', () => ({ prisma, Prisma: {} }));
vi.mock('../scraper/core/dedup', () => ({ canonicalizeUrl: vi.fn(), contentHash: vi.fn() }));

import { jobRepository } from './job.repository';

const run = async (raw: Record<string, unknown>) => {
  await jobRepository.list(ListJobsQuerySchema.parse(raw));
  const args = prisma.job.findMany.mock.calls[0]![0];
  return args as { where: Record<string, unknown>; orderBy: unknown; skip: number; take: number };
};

describe('jobRepository.list', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);
  });

  it('never returns inactive jobs', async () => {
    const { where } = await run({});
    expect(where.isActive).toBe(true);
  });

  it('searches trimmed text across title, company and description', async () => {
    const { where } = await run({ q: '  react intern  ' });
    expect(where.OR).toEqual([
      { title: { contains: 'react intern', mode: 'insensitive' } },
      { company: { contains: 'react intern', mode: 'insensitive' } },
      { description: { contains: 'react intern', mode: 'insensitive' } },
    ]);
  });

  it('ignores a whitespace-only query', async () => {
    const { where } = await run({ q: '   ' });
    expect(where.OR).toBeUndefined();
  });

  it('filters by platform and lowercased skills', async () => {
    const { where } = await run({ platform: 'LINKEDIN', skills: 'React, AWS' });
    expect(where.sourcePlatform).toBe('LINKEDIN');
    expect(where.skills).toEqual({ hasSome: ['react', 'aws'] });
  });

  it('paginates with skip/take and counts with the same filter', async () => {
    const { where, skip, take } = await run({ page: '3', pageSize: '10' });
    expect(skip).toBe(20);
    expect(take).toBe(10);
    expect(prisma.job.count).toHaveBeenCalledWith({ where });
  });

  it('sorts newest posted first with undated jobs last and a stable tiebreak', async () => {
    const { orderBy } = await run({});
    expect(orderBy).toEqual([{ postedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }]);
  });
});

describe('jobRepository.screenStoredJobs', () => {
  beforeEach(() => vi.resetAllMocks());

  it('deactivates stored jobs that are not fresher roles, keeping source-labelled entry jobs', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'a', title: 'Senior Recruiter', description: null, tags: [] },
      { id: 'b', title: 'Junior Developer', description: null, tags: [] },
      { id: 'c', title: 'Data Analyst', description: null, tags: ['entry-level'] },
      {
        id: 'd',
        title: 'Data Analyst',
        description: 'Needs 4+ years of experience',
        tags: ['entry-level'],
      },
    ]);
    prisma.job.updateMany.mockResolvedValue({ count: 2 });

    await expect(jobRepository.screenStoredJobs()).resolves.toBe(2);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(prisma.job.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'd'] } },
      data: { isActive: false },
    });
  });

  it('does nothing when every stored job qualifies', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'b', title: 'Graduate Engineer', description: null, tags: [] },
    ]);
    await expect(jobRepository.screenStoredJobs()).resolves.toBe(0);
    expect(prisma.job.updateMany).not.toHaveBeenCalled();
  });
});
