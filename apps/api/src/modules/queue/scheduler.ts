import { Queue } from 'bullmq';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';
import { scrapeSourceRepository } from '../scraper/scrape-source.repository';
import { scrapeRunRepository } from '../scraper/scrape-run.repository';

import { enqueueListing } from './queues';

interface CronJobData {
  sourceId: string;
}

export const schedulerQueue = new Queue<CronJobData>('scrape-scheduler', {
  connection: redis,
  prefix: env.BULL_PREFIX,
});

/** Reconcile DB-configured sources → BullMQ repeatable jobs. */
export const syncScheduledSources = async (): Promise<void> => {
  const sources = await scrapeSourceRepository.findEnabled();
  const repeatables = await schedulerQueue.getRepeatableJobs();
  const desiredKeys = new Set<string>();

  for (const src of sources) {
    if (!src.cron) continue;
    const jobName = `cron:${src.platform}`;
    desiredKeys.add(jobName);
    await schedulerQueue.add(
      jobName,
      { sourceId: src.id },
      { repeat: { pattern: src.cron }, jobId: jobName, removeOnComplete: true, removeOnFail: 100 },
    );
  }

  for (const r of repeatables) {
    if (!desiredKeys.has(r.name)) {
      await schedulerQueue.removeRepeatableByKey(r.key);
      logger.info({ name: r.name }, 'removed stale repeatable');
    }
  }
};

/** Worker side: explodes a scheduler tick into a fresh ScrapeRun + listing jobs. */
export const fanOutScheduledRun = async (sourceId: string): Promise<void> => {
  const source = await scrapeSourceRepository.list().then((all) => all.find((s) => s.id === sourceId));
  if (!source || !source.enabled) return;

  const queries = source.searchQueries.length ? source.searchQueries : [''];
  const locations = source.locations.length ? source.locations : [''];

  for (const query of queries) {
    for (const location of locations) {
      const run = await scrapeRunRepository.create({
        platform: source.platform,
        query: query || undefined,
        location: location || undefined,
        triggeredBy: 'scheduler',
        sourceId: source.id,
      });
      await scrapeRunRepository.markRunning(run.id);
      await enqueueListing({
        runId: run.id,
        platform: source.platform,
        query: query || undefined,
        location: location || undefined,
        page: 1,
        maxPages: env.SCRAPER_MAX_PAGES_PER_RUN,
      });
    }
  }
  await scrapeSourceRepository.touchLastRun(source.id);
};
