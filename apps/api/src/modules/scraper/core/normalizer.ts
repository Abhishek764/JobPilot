import type { NormalizedJob, SalaryPeriod, SourcePlatform } from '@jobpilot/types';

import type { RawJob } from './types';

const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

const SKILL_DICTIONARY = new Set(
  [
    'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'ruby', 'php', 'c++', 'c#',
    'react', 'next.js', 'vue', 'angular', 'svelte', 'node.js', 'express', 'nest.js',
    'django', 'flask', 'fastapi', 'spring', 'rails',
    'postgres', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra',
    'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ansible',
    'graphql', 'rest', 'grpc', 'kafka', 'rabbitmq',
    'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn',
    'figma', 'tailwind', 'css', 'html', 'sass',
  ].map((s) => s.toLowerCase()),
);

const ROLE_CATEGORIES: Array<[string, RegExp]> = [
  ['Engineering', /(engineer|developer|programmer|sde|swe|backend|frontend|fullstack|devops|sre)/i],
  ['Data', /(data\s+(scientist|engineer|analyst)|ml\s+engineer|machine\s+learning|analytics)/i],
  ['Design', /(designer|ux|ui|product\s+design)/i],
  ['Product', /(product\s+manager|pm|product\s+owner)/i],
  ['Marketing', /(marketing|growth|seo|content)/i],
  ['Sales', /(sales|account\s+executive|business\s+development|bdr|sdr)/i],
  ['Support', /(customer\s+support|customer\s+success|technical\s+support)/i],
  ['Operations', /(operations|recruiter|hr|finance|legal)/i],
];

export const detectRoleCategory = (title: string): string | null => {
  for (const [name, rx] of ROLE_CATEGORIES) if (rx.test(title)) return name;
  return null;
};

export const extractSkills = (text: string, hinted: string[] = []): string[] => {
  const out = new Set<string>(hinted.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const lc = text.toLowerCase();
  for (const skill of SKILL_DICTIONARY) {
    const pattern = new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(skill)}([^a-z0-9+#.]|$)`, 'i');
    if (pattern.test(lc)) out.add(skill);
  }
  return Array.from(out).slice(0, 50);
};

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const parseSalary = (
  text: string | null,
): {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: SalaryPeriod | null;
} => {
  if (!text) return { min: null, max: null, currency: null, period: null };
  const t = text.replace(/\s+/g, ' ').trim();
  const currency =
    /[$]|usd/i.test(t) ? 'USD' :
    /[€]|eur/i.test(t) ? 'EUR' :
    /[£]|gbp/i.test(t) ? 'GBP' :
    /[₹]|inr|rs\.?|rupees|lpa/i.test(t) ? 'INR' :
    null;

  const period: SalaryPeriod | null =
    /per\s+hour|\/hr|hourly/i.test(t) ? 'HOURLY' :
    /per\s+day|\/day|daily/i.test(t) ? 'DAILY' :
    /per\s+month|\/mo|monthly/i.test(t) ? 'MONTHLY' :
    /per\s+year|\/yr|annual|annum|year|lpa/i.test(t) ? 'YEARLY' :
    null;

  const numbers = Array.from(t.matchAll(/(\d+(?:[.,]\d+)?)\s*([kml]?)/gi)).map(([, n, unit]) => {
    const base = parseFloat((n ?? '0').replace(/,/g, ''));
    const mult = unit?.toLowerCase() === 'k' ? 1_000 : unit?.toLowerCase() === 'm' ? 1_000_000 : unit?.toLowerCase() === 'l' ? 100_000 : 1;
    return Math.round(base * mult);
  });

  if (numbers.length === 0) return { min: null, max: null, currency, period };
  if (numbers.length === 1) return { min: numbers[0]!, max: numbers[0]!, currency, period };
  const min = Math.min(numbers[0]!, numbers[1]!);
  const max = Math.max(numbers[0]!, numbers[1]!);
  return { min, max, currency, period };
};

export const parsePostedAt = (text: string | null): Date | null => {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  const now = Date.now();
  if (/just\s+posted|moments?\s+ago|today/.test(t)) return new Date(now);
  const rel = t.match(/(\d+)\s*(minute|hour|day|week|month)s?\s+ago/);
  if (rel) {
    const n = parseInt(rel[1]!, 10);
    const unit = rel[2]!;
    const ms =
      unit === 'minute' ? n * 60_000 :
      unit === 'hour' ? n * 3_600_000 :
      unit === 'day' ? n * 86_400_000 :
      unit === 'week' ? n * 7 * 86_400_000 :
      n * 30 * 86_400_000;
    return new Date(now - ms);
  }
  const monthRx = new RegExp(`(\\d{1,2})\\s+(${MONTH_NAMES.join('|')})\\s*(\\d{4})?`, 'i');
  const m = t.match(monthRx);
  if (m) {
    const day = parseInt(m[1]!, 10);
    const month = MONTH_NAMES.indexOf(m[2]!.toLowerCase());
    const year = m[3] ? parseInt(m[3]!, 10) : new Date().getFullYear();
    return new Date(Date.UTC(year, month, day));
  }
  const iso = Date.parse(text);
  return Number.isFinite(iso) ? new Date(iso) : null;
};

export const normalizeRaw = (raw: RawJob, platform: SourcePlatform): NormalizedJob => {
  const salary = parseSalary(raw.salaryText);
  const skills = extractSkills(`${raw.title}\n${raw.description ?? ''}`, raw.skillsText);
  const roleCategory = raw.roleCategoryText ?? detectRoleCategory(raw.title);
  return {
    externalId: raw.externalId,
    sourcePlatform: platform,
    source: platform.toLowerCase(),
    url: raw.url,
    applyUrl: raw.applyUrl ?? raw.url,
    title: raw.title.trim(),
    company: raw.company.trim(),
    location: raw.location?.trim() || null,
    remote: raw.remote || /remote|wfh|work\s+from\s+home/i.test(`${raw.title} ${raw.location ?? ''}`),
    description: raw.description ?? null,
    roleCategory,
    skills,
    salaryMin: salary.min,
    salaryMax: salary.max,
    currency: salary.currency,
    salaryPeriod: salary.period,
    postedAt: parsePostedAt(raw.postedAtText),
  };
};
