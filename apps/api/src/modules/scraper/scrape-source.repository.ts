import { prisma, type ScrapeSource } from '@jobpilot/db';
import type { Schemas, SourcePlatform } from '@jobpilot/types';

export const scrapeSourceRepository = {
  list(): Promise<ScrapeSource[]> {
    return prisma.scrapeSource.findMany({ orderBy: { platform: 'asc' } });
  },

  findEnabled(): Promise<ScrapeSource[]> {
    return prisma.scrapeSource.findMany({ where: { enabled: true } });
  },

  get(platform: SourcePlatform): Promise<ScrapeSource | null> {
    return prisma.scrapeSource.findUnique({ where: { platform } });
  },

  upsert(input: Schemas.UpsertScrapeSourceInput): Promise<ScrapeSource> {
    return prisma.scrapeSource.upsert({
      where: { platform: input.platform },
      create: {
        platform: input.platform,
        enabled: input.enabled ?? true,
        cron: input.cron ?? null,
        rateLimitPerMin: input.rateLimitPerMin ?? 20,
        maxConcurrency: input.maxConcurrency ?? 2,
        searchQueries: input.searchQueries ?? [],
        locations: input.locations ?? [],
      },
      update: {
        enabled: input.enabled,
        cron: input.cron === undefined ? undefined : input.cron,
        rateLimitPerMin: input.rateLimitPerMin,
        maxConcurrency: input.maxConcurrency,
        searchQueries: input.searchQueries,
        locations: input.locations,
      },
    });
  },

  touchLastRun(id: string): Promise<ScrapeSource> {
    return prisma.scrapeSource.update({ where: { id }, data: { lastRunAt: new Date() } });
  },
};
