import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_URL: z.string().url().default('http://localhost:4000'),
  API_VERSION: z.string().default('v1'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash-exp'),
  GEMINI_MATCH_MODEL: z.string().default('gemini-2.0-flash-exp'),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  AI_MAX_RESUME_CHARS: z.coerce.number().int().positive().default(12_000),
  AI_MAX_JOB_CHARS: z.coerce.number().int().positive().default(8_000),
  AI_MATCH_CONCURRENCY: z.coerce.number().int().positive().default(4),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  SCRAPER_USER_AGENT: z.string().default('Mozilla/5.0 (compatible; JobPilotBot/1.0)'),
  SCRAPER_HEADLESS: z
    .string()
    .default('true')
    .transform((s) => s !== 'false'),
  SCRAPER_LISTING_CONCURRENCY: z.coerce.number().int().positive().default(2),
  SCRAPER_DETAIL_CONCURRENCY: z.coerce.number().int().positive().default(4),
  SCRAPER_NORMALIZE_CONCURRENCY: z.coerce.number().int().positive().default(8),
  SCRAPER_MAX_RETRIES: z.coerce.number().int().min(0).max(20).default(5),
  SCRAPER_BACKOFF_MS: z.coerce.number().int().positive().default(15_000),
  SCRAPER_MAX_PAGES_PER_RUN: z.coerce.number().int().positive().default(5),
  SCRAPER_DEFAULT_RATE_PER_MIN: z.coerce.number().int().positive().default(20),
  SCRAPER_SCHEDULER_ENABLED: z
    .string()
    .default('false')
    .transform((s) => s === 'true'),
  BULL_PREFIX: z.string().default('jobpilot'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

export const env: Env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
