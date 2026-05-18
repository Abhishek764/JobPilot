import { Prisma, prisma, type Job } from '@jobpilot/db';
import type { NormalizedJob, Schemas } from '@jobpilot/types';

import { canonicalizeUrl, contentHash } from '../scraper/core/dedup';

export interface UpsertResult {
  job: Job;
  created: boolean;
}

export const jobRepository = {
  async upsertNormalized(input: NormalizedJob): Promise<UpsertResult> {
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
      tags: [],
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
    const where: Prisma.JobWhereInput = {
      isActive: true,
      ...(query.platform && { sourcePlatform: query.platform }),
      ...(query.company && { company: { contains: query.company, mode: 'insensitive' } }),
      ...(query.location && { location: { contains: query.location, mode: 'insensitive' } }),
      ...(query.remote !== undefined && { remote: query.remote }),
      ...(query.roleCategory && { roleCategory: query.roleCategory }),
      ...(query.skills?.length && { skills: { hasSome: query.skills.map((s: string) => s.toLowerCase()) } }),
      ...(query.salaryMin && { salaryMin: { gte: query.salaryMin } }),
      ...(query.postedAfter && { postedAt: { gte: query.postedAfter } }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { company: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.job.count({ where }),
    ]);

    return { items, total };
  },

  async markStaleInactive(platform: string, olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const res = await prisma.job.updateMany({
      where: { sourcePlatform: platform as Prisma.JobWhereInput['sourcePlatform'], lastSeenAt: { lt: cutoff }, isActive: true },
      data: { isActive: false },
    });
    return res.count;
  },
};
