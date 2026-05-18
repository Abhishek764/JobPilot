import type { NormalizedJob } from '@jobpilot/types';

import { logger } from '../../../config/logger';
import { UpstreamError } from '../../../shared/errors';

import { normalizeRaw } from './normalizer';
import { rateLimiter } from './rate-limiter';
import type {
  RawJob,
  ScrapeDetailInput,
  ScrapeListingInput,
  ScrapeListingResult,
  ScraperContext,
  SourceScraper,
} from './types';
import type { SourcePlatform } from '@jobpilot/types';

/**
 * Abstract base for source scrapers.
 *   - Wraps listing/detail in rate-limited acquires.
 *   - Provides retry helper with exponential backoff.
 *   - Hands off raw → normalized via shared normalizer; subclasses may override.
 */
export abstract class BaseSourceScraper implements SourceScraper {
  abstract readonly platform: SourcePlatform;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;
  readonly defaultRateLimitPerMin: number = 20;

  protected abstract scrapeListing(
    ctx: ScraperContext,
    input: ScrapeListingInput,
  ): Promise<ScrapeListingResult>;

  protected abstract scrapeDetail(ctx: ScraperContext, input: ScrapeDetailInput): Promise<RawJob>;

  async listing(ctx: ScraperContext, input: ScrapeListingInput): Promise<ScrapeListingResult> {
    await rateLimiter.waitAndAcquire(`platform:${this.platform}`, this.defaultRateLimitPerMin);
    return this.withRetry(`listing:${this.platform}:${input.page ?? 1}`, () =>
      this.scrapeListing(ctx, input),
    );
  }

  async detail(ctx: ScraperContext, input: ScrapeDetailInput): Promise<RawJob> {
    await rateLimiter.waitAndAcquire(`platform:${this.platform}`, this.defaultRateLimitPerMin);
    return this.withRetry(`detail:${this.platform}`, () => this.scrapeDetail(ctx, input));
  }

  normalize(raw: RawJob): NormalizedJob {
    return normalizeRaw(raw, this.platform);
  }

  protected async withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const backoff = Math.min(2 ** i * 500 + Math.random() * 400, 8_000);
        logger.warn({ label, attempt: i + 1, backoff, err: (err as Error).message }, 'scraper retry');
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw new UpstreamError(`scraper failed: ${label}`, { cause: (lastErr as Error)?.message });
  }
}
