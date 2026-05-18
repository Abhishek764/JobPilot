export const SOURCE_PLATFORMS = ['LINKEDIN', 'WELLFOUND', 'INDEED', 'NAUKRI', 'CUSTOM'] as const;
export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

export const SALARY_PERIODS = ['HOURLY', 'DAILY', 'MONTHLY', 'YEARLY'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const SCRAPE_RUN_STATUSES = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'PARTIAL',
] as const;
export type ScrapeRunStatus = (typeof SCRAPE_RUN_STATUSES)[number];

export interface Job {
  id: string;
  externalId: string | null;
  sourcePlatform: SourcePlatform;
  source: string;
  url: string;
  applyUrl: string;
  contentHash: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string | null;
  roleCategory: string | null;
  skills: string[];
  tags: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  salaryPeriod: SalaryPeriod | null;
  postedAt: Date | null;
  scrapedAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
}

export interface NormalizedJob {
  externalId: string | null;
  sourcePlatform: SourcePlatform;
  source: string;
  url: string;
  applyUrl: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string | null;
  roleCategory: string | null;
  skills: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  salaryPeriod: SalaryPeriod | null;
  postedAt: Date | null;
}

export interface JobMatch {
  jobId: string;
  score: number;
  reasoning: string;
  matchedSkills: string[];
  missingSkills: string[];
}
