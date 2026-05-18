import { prisma, type Job } from '@jobpilot/db';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { UpstreamError } from '../../shared/errors';

import { acquireScraperContext } from './browser';
import { canonicalizeUrl, contentHash } from './core/dedup';

interface ScrapedJob {
  title: string;
  company: string;
  location: string | null;
  description: string;
  url: string;
}

const scrapeUrl = async (url: string): Promise<ScrapedJob> => {
  const handle = await acquireScraperContext();
  try {
    await handle.page.goto(url, { timeout: env.SCRAPER_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
    const data = await handle.page.evaluate(() => ({
      title:
        document.querySelector('h1')?.textContent?.trim() ??
        document.querySelector('[data-test="job-title"]')?.textContent?.trim() ??
        '',
      company:
        document.querySelector('[data-test="company-name"]')?.textContent?.trim() ??
        document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ??
        '',
      location: document.querySelector('[data-test="location"]')?.textContent?.trim() ?? null,
      description: document.body.innerText.slice(0, 20_000),
    }));
    if (!data.title) throw new UpstreamError('Failed to extract job title');
    return { ...data, url };
  } catch (err) {
    logger.error({ err, url }, 'scrape failed');
    throw err instanceof UpstreamError ? err : new UpstreamError('Scrape failed', { url });
  } finally {
    await handle.close();
  }
};

export const scraperService = {
  async scrapeAndStore(rawUrl: string): Promise<Job> {
    const data = await scrapeUrl(rawUrl);
    const url = canonicalizeUrl(rawUrl);
    const host = new URL(url).hostname;
    const company = data.company || host;
    const hash = contentHash({
      sourcePlatform: 'CUSTOM',
      company,
      title: data.title,
      location: data.location,
      externalId: null,
      url,
    });

    return prisma.job.upsert({
      where: { url },
      update: {
        title: data.title,
        company,
        location: data.location,
        description: data.description,
        scrapedAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      },
      create: {
        url,
        applyUrl: url,
        contentHash: hash,
        sourcePlatform: 'CUSTOM',
        title: data.title,
        company,
        location: data.location,
        description: data.description,
        source: host,
      },
    });
  },
};
