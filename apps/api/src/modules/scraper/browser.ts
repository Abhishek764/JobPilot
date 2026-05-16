import { chromium, type Browser } from 'playwright';

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
