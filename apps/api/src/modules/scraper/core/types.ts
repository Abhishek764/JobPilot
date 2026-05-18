import type { NormalizedJob, SourcePlatform } from '@jobpilot/types';
import type { BrowserContext, Page } from 'playwright';

export interface ScrapeListingInput {
  runId: string;
  query?: string;
  location?: string;
  maxPages: number;
  page?: number;
}

export interface ScrapeListingResult {
  jobUrls: string[];
  nextPage: number | null;
  pageNumber: number;
}

export interface ScrapeDetailInput {
  runId: string;
  url: string;
}

export interface RawJob {
  url: string;
  externalId: string | null;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  applyUrl: string | null;
  postedAtText: string | null;
  salaryText: string | null;
  skillsText: string[];
  roleCategoryText: string | null;
  remote: boolean;
  raw?: Record<string, unknown>;
}

export interface ScraperContext {
  context: BrowserContext;
  page: Page;
}

export interface SourceScraper {
  readonly platform: SourcePlatform;
  readonly displayName: string;
  readonly baseUrl: string;
  /** sliding-window cap, requests/minute */
  readonly defaultRateLimitPerMin: number;
  listing(ctx: ScraperContext, input: ScrapeListingInput): Promise<ScrapeListingResult>;
  detail(ctx: ScraperContext, input: ScrapeDetailInput): Promise<RawJob>;
  normalize(raw: RawJob): NormalizedJob;
}
