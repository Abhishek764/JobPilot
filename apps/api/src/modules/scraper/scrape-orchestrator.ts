import type { ScrapeRun } from '@jobpilot/db';
import type { SourcePlatform } from '@jobpilot/types';

import { env } from '../../config/env';
import { enqueueListing } from '../queue/queues';

import { scrapeRunRepository } from './scrape-run.repository';
import { scraperRegistry } from './core/registry';

export interface TriggerRunInput {
  platform: SourcePlatform;
  query?: string;
  location?: string;
  maxPages?: number;
  triggeredBy?: string;
}

export const scrapeOrchestrator = {
  async trigger(input: TriggerRunInput): Promise<ScrapeRun> {
    if (!scraperRegistry.has(input.platform)) {
      throw new Error(`platform ${input.platform} not implemented`);
    }
    const run = await scrapeRunRepository.create({
      platform: input.platform,
      query: input.query,
      location: input.location,
      triggeredBy: input.triggeredBy ?? 'api',
    });
    await scrapeRunRepository.markRunning(run.id);
    await enqueueListing({
      runId: run.id,
      platform: input.platform,
      query: input.query,
      location: input.location,
      page: 1,
      maxPages: input.maxPages ?? env.SCRAPER_MAX_PAGES_PER_RUN,
    });
    return run;
  },
};
