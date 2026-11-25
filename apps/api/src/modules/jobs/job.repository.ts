import type { Prisma } from '@jobpilot/db';
import { prisma, type Job } from '@jobpilot/db';
import type { NormalizedJob, Schemas } from '@jobpilot/types';

import { canonicalizeUrl, contentHash } from '../scraper/core/dedup';

import { isFresherJob } from './fresher';

/** Tag marking a job its source labelled entry-level, so re-screening keeps it. */
export const ENTRY_LEVEL_TAG = 'entry-level';

export interface UpsertResult {
  job: Job;
  created: boolean;
}

export const jobRepository = {
  async upsertNormalized(
    input: NormalizedJob & { sourceIsEntryLevel?: boolean },
  ): Promise<UpsertResult> {
    const url = canonicalizeUrl(input.url);
    const hash = contentHash({ ...input, url });

    const existing = await prisma.job.findFirst({
      where: { OR: [{ url }, { contentHash: hash }] },
      select: { id: true },
    });

    const data = {
      externalId: input.externalId,
      sourcePlatform: input.sourcePlatform,
      source: input.source,
      url,
      applyUrl: input.applyUrl,
      contentHash: hash,
      title: input.title,
      company: input.company,
      location: input.location,
      remote: input.remote,
      description: input.description,
      roleCategory: input.roleCategory,
      skills: input.skills,
      tags: input.sourceIsEntryLevel ? [ENTRY_LEVEL_TAG] : [],
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      currency: input.currency,
      salaryPeriod: input.salaryPeriod,
      postedAt: input.postedAt,
    } satisfies Prisma.JobUncheckedCreateInput;

    if (existing) {
      const job = await prisma.job.update({
        where: { id: existing.id },
        data: { ...data, lastSeenAt: new Date(), isActive: true },
      });
      return { job, created: false };
    }
    const job = await prisma.job.create({ data });
    return { job, created: true };
  },

  async findById(id: string): Promise<Job | null> {
    return prisma.job.findUnique({ where: { id } });
  },

  async list(query: Schemas.ListJobsQuery): Promise<{ items: Job[]; total: number }> {
    const q = query.q?.trim();
    const where: Prisma.JobWhereInput = {
      isActive: true,
      ...(query.platform && { sourcePlatform: query.platform }),
      ...(query.company && { company: { contains: query.company, mode: 'insensitive' } }),
      ...(query.location && { location: { contains: query.location, mode: 'insensitive' } }),
      ...(query.remote !== undefined && { remote: query.remote }),
      ...(query.roleCategory && { roleCategory: query.roleCategory }),
      ...(query.skills?.length && {
        skills: { hasSome: query.skills.map((s: string) => s.toLowerCase()) },
      }),
      ...(query.salaryMin && { salaryMin: { gte: query.salaryMin } }),
      ...(query.postedAfter && { postedAt: { gte: query.postedAfter } }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        // Undated postings sort after dated ones; id keeps pagination stable.
        orderBy: [
          query.sortBy === 'postedAt'
            ? { postedAt: { sort: query.sortDir, nulls: 'last' } }
            : { scrapedAt: query.sortDir },
          { id: 'desc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.job.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Deactivate active jobs that are not fresher roles (e.g. senior postings stored before
   * the filter, or from scrapers). Rows are kept, just hidden. Returns how many changed.
   */
  async screenStoredJobs(): Promise<number> {
    const active = await prisma.job.findMany({
      where: { isActive: true },
      select: { id: true, title: true, description: true, tags: true },
    });
    const ids = active
      .filter((j) => !isFresherJob(j, { sourceIsEntryLevel: j.tags.includes(ENTRY_LEVEL_TAG) }))
      .map((j) => j.id);
    if (ids.length === 0) return 0;
    const res = await prisma.job.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });
    return res.count;
  },

  async markStaleInactive(platform: string, olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const res = await prisma.job.updateMany({
      where: {
        sourcePlatform: platform as Prisma.JobWhereInput['sourcePlatform'],
        lastSeenAt: { lt: cutoff },
        isActive: true,
      },
      data: { isActive: false },
    });
    return res.count;
  },
};
