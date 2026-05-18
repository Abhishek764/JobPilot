import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

import { env } from '../../config/env';
import { logger } from '../../config/logger';

let browserPromise: Promise<Browser> | null = null;

export const getBrowser = (): Promise<Browser> => {
  if (!browserPromise) {
    logger.info('Launching Playwright browser');
    browserPromise = chromium.launch({ headless: env.SCRAPER_HEADLESS });
  }
  return browserPromise;
};

export const closeBrowser = async (): Promise<void> => {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
};

export interface ScraperBrowserHandle {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export const acquireScraperContext = async (): Promise<ScraperBrowserHandle> => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: env.SCRAPER_USER_AGENT,
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
    timezoneId: 'UTC',
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
  });
  context.setDefaultNavigationTimeout(env.SCRAPER_TIMEOUT_MS);
  context.setDefaultTimeout(env.SCRAPER_TIMEOUT_MS);
  await context.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (t === 'image' || t === 'media' || t === 'font') return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  return {
    context,
    page,
    close: async () => {
      await context.close().catch(() => undefined);
    },
  };
};
