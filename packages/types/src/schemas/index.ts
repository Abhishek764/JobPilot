import { z } from 'zod';

import { APPLICATION_STATUSES } from '../domain/application';
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

export const AnalyzeResumeSchema = z.object({
  resumeId: z.string().cuid(),
  jobId: z.string().cuid().optional(),
  jobDescription: z.string().min(50).optional(),
});

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
