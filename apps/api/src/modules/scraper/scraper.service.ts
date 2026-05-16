import { prisma, type Job } from '@jobpilot/db';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { UpstreamError } from '../../shared/errors';

import { getBrowser } from './browser';

interface ScrapedJob {
  title: string;
  company: string;
  location: string | null;
  description: string;
  url: string;
}

const scrapeUrl = async (url: string): Promise<ScrapedJob> => {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: env.SCRAPER_USER_AGENT });
  const page = await context.newPage();
  try {
    await page.goto(url, { timeout: env.SCRAPER_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
    const data = await page.evaluate(() => ({
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
    await context.close();
  }
};

export const scraperService = {
  async scrapeAndStore(url: string): Promise<Job> {
    const data = await scrapeUrl(url);
    const host = new URL(url).hostname;
    return prisma.job.upsert({
      where: { url },
      update: {
        title: data.title,
        company: data.company || host,
        location: data.location,
        description: data.description,
        scrapedAt: new Date(),
      },
      create: {
        url,
        title: data.title,
        company: data.company || host,
        location: data.location,
        description: data.description,
        source: host,
      },
    });
  },
};
