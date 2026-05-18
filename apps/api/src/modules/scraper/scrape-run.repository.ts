import { prisma, type ScrapeRun, type Prisma } from '@jobpilot/db';
import type { Schemas, SourcePlatform } from '@jobpilot/types';

export interface CreateRunInput {
  platform: SourcePlatform;
  query?: string;
  location?: string;
  triggeredBy?: string;
  sourceId?: string;
}

export const scrapeRunRepository = {
  create(input: CreateRunInput): Promise<ScrapeRun> {
    return prisma.scrapeRun.create({
      data: {
        platform: input.platform,
        query: input.query,
        location: input.location,
        triggeredBy: input.triggeredBy,
        sourceId: input.sourceId,
      },
    });
  },

  markRunning(id: string): Promise<ScrapeRun> {
    return prisma.scrapeRun.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  },

  finish(
    id: string,
    patch: { status: 'COMPLETED' | 'FAILED' | 'PARTIAL'; error?: string },
  ): Promise<ScrapeRun> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.scrapeRun.findUniqueOrThrow({ where: { id } });
      const finishedAt = new Date();
      const durationMs = existing.startedAt
        ? finishedAt.getTime() - existing.startedAt.getTime()
        : null;
      return tx.scrapeRun.update({
        where: { id },
        data: { ...patch, finishedAt, durationMs: durationMs ?? undefined },
      });
    });
  },

  incrementCounts(
    id: string,
    counts: { jobsFound?: number; jobsNew?: number; jobsUpdated?: number; jobsFailed?: number; pagesScraped?: number },
  ): Promise<ScrapeRun> {
    const data: Prisma.ScrapeRunUpdateInput = {};
    if (counts.jobsFound) data.jobsFound = { increment: counts.jobsFound };
    if (counts.jobsNew) data.jobsNew = { increment: counts.jobsNew };
    if (counts.jobsUpdated) data.jobsUpdated = { increment: counts.jobsUpdated };
    if (counts.jobsFailed) data.jobsFailed = { increment: counts.jobsFailed };
    if (counts.pagesScraped) data.pagesScraped = { increment: counts.pagesScraped };
    return prisma.scrapeRun.update({ where: { id }, data });
  },

  list(query: Schemas.ListScrapeRunsQuery): Promise<{ items: ScrapeRun[]; total: number }> {
    const where: Prisma.ScrapeRunWhereInput = {
      ...(query.platform && { platform: query.platform }),
      ...(query.status && { status: query.status }),
    };
    return Promise.all([
      prisma.scrapeRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.scrapeRun.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  },
};
