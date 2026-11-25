import type { Job } from '@jobpilot/types';

const PLATFORM_LABELS: Record<string, string> = {
  LINKEDIN: 'LinkedIn',
  WELLFOUND: 'Wellfound',
  INDEED: 'Indeed',
  NAUKRI: 'Naukri',
  REMOTIVE: 'Remotive',
  ARBEITNOW: 'Arbeitnow',
  JOBICY: 'Jobicy',
  CUSTOM: 'Direct',
};

export const platformLabel = (platform: string): string => PLATFORM_LABELS[platform] ?? platform;

const PERIOD_SUFFIX: Record<string, string> = {
  HOURLY: '/hr',
  DAILY: '/day',
  MONTHLY: '/mo',
  YEARLY: '/yr',
};

/** Only renders salary the source actually published; returns null otherwise. */
export const formatSalary = (
  job: Pick<Job, 'salaryMin' | 'salaryMax' | 'currency' | 'salaryPeriod'>,
) => {
  const { salaryMin, salaryMax, currency, salaryPeriod } = job;
  if (salaryMin == null && salaryMax == null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en', {
      style: currency ? 'currency' : 'decimal',
      currency: currency ?? undefined,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  const range =
    salaryMin != null && salaryMax != null && salaryMin !== salaryMax
      ? `${fmt(salaryMin)} – ${fmt(salaryMax)}`
      : fmt((salaryMin ?? salaryMax)!);
  return `${range}${salaryPeriod ? (PERIOD_SUFFIX[salaryPeriod] ?? '') : ''}`;
};

export const formatPosted = (postedAt: Date | string | null): string => {
  if (!postedAt) return 'Date not listed';
  const date = new Date(postedAt);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};
