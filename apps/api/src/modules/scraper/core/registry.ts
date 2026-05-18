import type { SourcePlatform } from '@jobpilot/types';

import type { SourceScraper } from './types';

class ScraperRegistry {
  private readonly map = new Map<SourcePlatform, SourceScraper>();

  register(scraper: SourceScraper): void {
    this.map.set(scraper.platform, scraper);
  }

  get(platform: SourcePlatform): SourceScraper {
    const s = this.map.get(platform);
    if (!s) throw new Error(`no scraper registered for platform ${platform}`);
    return s;
  }

  list(): SourceScraper[] {
    return Array.from(this.map.values());
  }

  has(platform: SourcePlatform): boolean {
    return this.map.has(platform);
  }
}

export const scraperRegistry = new ScraperRegistry();
