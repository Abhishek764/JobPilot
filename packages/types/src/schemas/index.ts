import { z } from 'zod';

import { APPLICATION_STATUSES } from '../domain/application';
import { SALARY_PERIODS, SOURCE_PLATFORMS } from '../domain/job';
import { EXPERIENCE_LEVELS, ROLES } from '../domain/user';

const httpsUrl = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), { message: 'must use https' });

export const RoleSchema = z.enum(ROLES);
export const ExperienceLevelSchema = z.enum(EXPERIENCE_LEVELS);

export const SkillsSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(50)
  .transform((arr) => Array.from(new Set(arr.map((s) => s.toLowerCase()))));

export const PreferredRolesSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(20)
  .transform((arr) => Array.from(new Set(arr)));

export const OnboardingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  experienceLevel: ExperienceLevelSchema,
  skills: SkillsSchema.refine((s) => s.length >= 1, { message: 'add at least one skill' }),
  preferredRoles: PreferredRolesSchema.refine((s) => s.length >= 1, {
    message: 'add at least one preferred role',
  }),
  location: z.string().trim().max(120).optional().nullable(),
  bio: z.string().trim().max(1_000).optional().nullable(),
  resumeUrl: httpsUrl.optional().nullable(),
  githubUrl: httpsUrl
    .refine((v) => /github\.com/i.test(v), { message: 'must be a github.com url' })
    .optional()
    .nullable(),
  linkedinUrl: httpsUrl
    .refine((v) => /linkedin\.com/i.test(v), { message: 'must be a linkedin.com url' })
    .optional()
    .nullable(),
});

export const UpdateProfileSchema = OnboardingSchema.partial();

export type OnboardingInput = z.infer<typeof OnboardingSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);

export const CreateApplicationSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  status: ApplicationStatusSchema.default('SAVED'),
  appliedAt: z.coerce.date().optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  url: z.string().url().optional().nullable(),
  salaryMin: z.number().int().nonnegative().optional().nullable(),
  salaryMax: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  jobId: z.string().cuid().optional().nullable(),
});

export const UpdateApplicationSchema = CreateApplicationSchema.partial();

export const ListApplicationsQuerySchema = PaginationSchema.extend({
  status: ApplicationStatusSchema.optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'appliedAt', 'company']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const ScrapeJobSchema = z.object({
  url: z.string().url(),
});

export const SourcePlatformSchema = z.enum(SOURCE_PLATFORMS);
export const SalaryPeriodSchema = z.enum(SALARY_PERIODS);

export const NormalizedJobSchema = z.object({
  externalId: z.string().min(1).max(200).nullable(),
  sourcePlatform: SourcePlatformSchema,
  source: z.string().min(1).max(100),
  url: z.string().url(),
  applyUrl: z.string().url(),
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable(),
  remote: z.boolean().default(false),
  description: z.string().max(50_000).nullable(),
  roleCategory: z.string().trim().max(100).nullable(),
  skills: z.array(z.string().trim().min(1).max(60)).max(100).default([]),
  salaryMin: z.number().int().nonnegative().nullable(),
  salaryMax: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  salaryPeriod: SalaryPeriodSchema.nullable(),
  postedAt: z.coerce.date().nullable(),
});

export const TriggerScrapeRunSchema = z.object({
  platform: SourcePlatformSchema,
  query: z.string().trim().min(1).max(200).optional(),
  location: z.string().trim().max(120).optional(),
  maxPages: z.coerce.number().int().min(1).max(20).optional(),
});

export const ListJobsQuerySchema = PaginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  platform: SourcePlatformSchema.optional(),
  company: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  remote: z.coerce.boolean().optional(),
  roleCategory: z.string().trim().max(100).optional(),
  skills: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .pipe(z.array(z.string().trim().min(1)).max(20))
    .optional(),
  salaryMin: z.coerce.number().int().nonnegative().optional(),
  postedAfter: z.coerce.date().optional(),
  sortBy: z.enum(['postedAt', 'scrapedAt']).default('postedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const ListScrapeRunsQuerySchema = PaginationSchema.extend({
  platform: SourcePlatformSchema.optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL']).optional(),
});

export const UpsertScrapeSourceSchema = z.object({
  platform: SourcePlatformSchema,
  enabled: z.boolean().optional(),
  cron: z
    .string()
    .trim()
    .regex(/^([0-9*,\-/]+\s+){4}[0-9*,\-/]+$/, { message: 'invalid cron expression' })
    .nullable()
    .optional(),
  rateLimitPerMin: z.number().int().min(1).max(600).optional(),
  maxConcurrency: z.number().int().min(1).max(20).optional(),
  searchQueries: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  locations: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
});

export type TriggerScrapeRunInput = z.infer<typeof TriggerScrapeRunSchema>;
export type ListJobsQuery = z.infer<typeof ListJobsQuerySchema>;
export type ListScrapeRunsQuery = z.infer<typeof ListScrapeRunsQuerySchema>;
export type UpsertScrapeSourceInput = z.infer<typeof UpsertScrapeSourceSchema>;
export type NormalizedJobInput = z.infer<typeof NormalizedJobSchema>;

export const AnalyzeResumeSchema = z.object({
  resumeId: z.string().cuid(),
  jobId: z.string().cuid().optional(),
  jobDescription: z.string().min(50).optional(),
});

export const MATCH_TRACKS = ['BACKEND', 'FRONTEND', 'FULLSTACK', 'DEVOPS'] as const;
export const MATCH_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] as const;
export const MatchTrackSchema = z.enum(MATCH_TRACKS);
export const MatchStatusSchema = z.enum(MATCH_STATUSES);

export const CreateMatchAnalysisSchema = z
  .object({
    resumeId: z.string().cuid(),
    track: MatchTrackSchema,
    jobId: z.string().cuid().optional(),
    jobDescription: z.string().min(50).max(50_000).optional(),
  })
  .refine((v) => Boolean(v.jobId) || Boolean(v.jobDescription), {
    message: 'jobId or jobDescription is required',
    path: ['jobDescription'],
  });

export const ListMatchAnalysesQuerySchema = PaginationSchema.extend({
  track: MatchTrackSchema.optional(),
  status: MatchStatusSchema.optional(),
});

export type MatchTrackInput = z.infer<typeof MatchTrackSchema>;
export type MatchStatusInput = z.infer<typeof MatchStatusSchema>;
export type CreateMatchAnalysisInput = z.infer<typeof CreateMatchAnalysisSchema>;
export type ListMatchAnalysesQuery = z.infer<typeof ListMatchAnalysesQuerySchema>;

export const CreateResumeSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(50),
  fileUrl: z.string().url().optional().nullable(),
});

export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;
export type ListApplicationsQuery = z.infer<typeof ListApplicationsQuerySchema>;
export type ScrapeJobInput = z.infer<typeof ScrapeJobSchema>;
export type AnalyzeResumeInput = z.infer<typeof AnalyzeResumeSchema>;
export type CreateResumeInput = z.infer<typeof CreateResumeSchema>;
