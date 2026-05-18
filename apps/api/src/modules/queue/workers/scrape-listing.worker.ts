import { Worker } from 'bullmq';

import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { redis } from '../../../config/redis';
import { acquireScraperContext } from '../../scraper/browser';
import { scraperRegistry } from '../../scraper/core/registry';
import { reserveUrl } from '../../scraper/core/dedup';
import { scrapeRunRepository } from '../../scraper/scrape-run.repository';
import { registerScrapers } from '../../scraper/sources';
import { enqueueDetail, enqueueListing, type ScrapeListingJob } from '../queues';

export const createScrapeListingWorker = (): Worker<ScrapeListingJob> => {
  registerScrapers();

  const worker = new Worker<ScrapeListingJob>(
    'scrape-listing',
    async (job) => {
      const { runId, platform, query, location, page, maxPages } = job.data;
      const scraper = scraperRegistry.get(platform);
      const handle = await acquireScraperContext();
      try {
        const result = await scraper.listing(
          { context: handle.context, page: handle.page },
          { runId, query, location, maxPages, page },
        );

        let queued = 0;
        for (const url of result.jobUrls) {
          if (await reserveUrl(url)) {
            await enqueueDetail({ runId, platform, url });
            queued++;
          }
        }

        await scrapeRunRepository.incrementCounts(runId, {
          pagesScraped: 1,
          jobsFound: result.jobUrls.length,
        });

        if (result.nextPage) {
          await enqueueListing({
            runId,
            platform,
            query,
            location,
            page: result.nextPage,
            maxPages,
          });
        }

        logger.info(
          { runId, platform, page, found: result.jobUrls.length, queued, next: result.nextPage },
          'listing scraped',
        );
        return { found: result.jobUrls.length, queued };
      } finally {
        await handle.close();
      }
    },
    {
      connection: redis,
      prefix: env.BULL_PREFIX,
      concurrency: env.SCRAPER_LISTING_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ id: job?.id, err: err.message, attempts: job?.attemptsMade }, 'listing job failed');
  });
  return worker;
};
