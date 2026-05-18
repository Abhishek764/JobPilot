import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { acquireScraperContext } from '../../scraper/browser';
import { scraperRegistry } from '../../scraper/core/registry';
import { scrapeRunRepository } from '../../scraper/scrape-run.repository';
import { registerScrapers } from '../../scraper/sources';
import { enqueueNormalize, type ScrapeDetailJob } from '../queues';

export const createScrapeDetailWorker = (): Worker<ScrapeDetailJob> => {
  registerScrapers();

  const worker = new Worker<ScrapeDetailJob>(
    'scrape-detail',
    async (job) => {
      const { runId, platform, url } = job.data;
      const scraper = scraperRegistry.get(platform);
      const handle = await acquireScraperContext();
      try {
        const raw = await scraper.detail(
          { context: handle.context, page: handle.page },
          { runId, url },
        );
        const normalized = scraper.normalize(raw);
        await enqueueNormalize({ runId, platform, normalized });
        return { ok: true };
      } catch (err) {
        await scrapeRunRepository.incrementCounts(runId, { jobsFailed: 1 });
        logger.warn({ runId, platform, url, err: (err as Error).message }, 'detail scrape failed');
        throw err;
      } finally {
        await handle.close();
      }
    },
    {
      connection: redis,
      prefix: env.BULL_PREFIX,
      concurrency: env.SCRAPER_DETAIL_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) =>
    logger.error({ id: job?.id, err: err.message, attempts: job?.attemptsMade }, 'detail job failed'),
  );
  return worker;
};
