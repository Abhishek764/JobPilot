# Student JobPilot MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a real-data student job-search MVP on top of the existing Next.js, Express, Prisma, Redis/BullMQ, scraper, resume, and AI foundations.

**Architecture:** Keep the existing user-owned data model and feature-slice architecture. Add thin API modules for dashboard and resume workflows, complete the existing job/match/application flows, and build the student UI around database-backed queries. Expensive scraping, parsing, and AI work remains queue-backed and observable.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Tailwind/shadcn, Express, Zod, Clerk, Prisma 5/PostgreSQL 16, Redis 7, BullMQ, Playwright, S3-compatible storage, Gemini, Vitest.

## Global Constraints

- Student/job-seeker experience only; no recruiter or company workflows.
- Real PostgreSQL records only; no hardcoded dashboard or candidate data.
- Preserve existing Clerk authentication, application board, scraper modules, resume work, queues, and AI matching.
- All student records remain scoped by authenticated `userId`.
- AI output must expose evidence, score/confidence, and a student-controlled next action.
- Do not infer or use protected characteristics.
- Every logical slice gets focused tests, verification, diff review, and a conventional commit.
- Do not stage unrelated existing work in `apps/api/src/modules/queue/queues.ts`, `apps/api/src/modules/queue/workers/resume-parse.worker.ts`, or `apps/api/src/modules/resume/` while committing other slices.

---

## File Map

### API files

- `apps/api/src/routes/v1.ts` — mount student dashboard and resume routers.
- `apps/api/src/modules/dashboard/dashboard.repository.ts` — user-scoped Prisma aggregates.
- `apps/api/src/modules/dashboard/dashboard.service.ts` — dashboard summary contract.
- `apps/api/src/modules/dashboard/dashboard.routes.ts` — authenticated summary endpoint.
- `apps/api/src/modules/resume/resume.routes.ts` — authenticated upload, ingest, list, detail, download, delete endpoints.
- `apps/api/src/modules/resume/resume.controller.ts` — HTTP translation for resume service calls.
- `apps/api/src/modules/jobs/job.repository.ts` — search and job detail queries.
- `apps/api/src/modules/jobs/job.service.ts` — validated job behavior.
- `apps/api/src/modules/jobs/job.routes.ts` — job list/detail endpoints.
- `apps/api/src/modules/applications/*` — existing board, event, note, reminder behavior.
- `apps/api/src/modules/ai/*` — existing match behavior plus student-facing evidence response.

### Shared contract files

- `packages/types/src/schemas/index.ts` — request validation and inferred API inputs.
- `packages/types/src/api/responses.ts` — shared response types.
- `packages/types/src/domain/job.ts` — job source and domain values.
- `packages/types/src/domain/resume.ts` — resume statuses and artifact types.
- `packages/types/src/index.ts` — public exports.

### Web files

- `apps/web/src/app/(student)/layout.tsx` — authenticated student navigation shell.
- `apps/web/src/app/(student)/dashboard/page.tsx` — server-rendered dashboard entry.
- `apps/web/src/app/(student)/dashboard/dashboard-client.tsx` — interactive search and summary cards.
- `apps/web/src/app/(student)/jobs/page.tsx` — real job search page.
- `apps/web/src/app/(student)/jobs/[id]/page.tsx` — job detail and match action.
- `apps/web/src/app/(student)/resume/page.tsx` — Resume Lab.
- `apps/web/src/app/(student)/resume/[id]/page.tsx` — resume detail, parse status, analyses, versions.
- `apps/web/src/app/(student)/applications/page.tsx` — move existing applications page into the student shell without changing board behavior.
- `apps/web/src/features/dashboard/api.ts` — dashboard API client.
- `apps/web/src/features/jobs/api.ts` — jobs API client and query serialization.
- `apps/web/src/features/jobs/components/job-search.tsx` — search/filter UI.
- `apps/web/src/features/jobs/components/job-card.tsx` — real job summary card.
- `apps/web/src/features/jobs/components/job-detail.tsx` — job detail and application actions.
- `apps/web/src/features/resumes/api.ts` — upload/ingest/detail API client.
- `apps/web/src/features/resumes/components/resume-uploader.tsx` — presigned upload flow.
- `apps/web/src/features/resumes/components/resume-status.tsx` — processing/error/success states.
- `apps/web/src/components/student/student-shell.tsx` — responsive navigation and page frame.
- `apps/web/src/app/globals.css` — dark premium visual tokens and reduced-motion rules.

### Tests

- `apps/api/src/modules/dashboard/dashboard.repository.test.ts`
- `apps/api/src/modules/jobs/job.repository.test.ts`
- `apps/api/src/modules/resume/resume.routes.test.ts`
- `apps/api/src/modules/ai/match.service.test.ts`
- `apps/api/src/modules/applications/application.service.test.ts`
- `packages/types/src/schemas/index.test.ts`

---

## Task 1: Establish a clean baseline and shared contracts

**Files:**
- Create: `packages/types/src/schemas/index.test.ts`
- Modify: `packages/types/src/schemas/index.ts`
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Consumes: existing `ListJobsQuerySchema`, `CreateMatchAnalysisSchema`, `UploadResumeSchema`, application schemas.
- Produces: stable inferred types for jobs, dashboard metrics, and resume routes.

- [ ] **Step 1: Write schema regression tests**

```ts
import { describe, expect, it } from 'vitest';
import { ListJobsQuerySchema, UploadResumeSchema } from './index';

describe('student API schemas', () => {
  it('normalizes comma-separated job skills', () => {
    expect(ListJobsQuerySchema.parse({ skills: 'node.js, AWS', page: '1' }).skills).toEqual([
      'node.js',
      'AWS',
    ]);
  });

  it('accepts only PDF upload tickets', () => {
    expect(() =>
      UploadResumeSchema.parse({ title: 'Resume', filename: 'resume.pdf', contentType: 'application/pdf', sizeBytes: 1000 }),
    ).not.toThrow();
    expect(() =>
      UploadResumeSchema.parse({ title: 'Resume', filename: 'resume.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 1000 }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test to confirm the current contract**

Run: `pnpm --filter @jobpilot/api exec vitest run ../../packages/types/src/schemas/index.test.ts`

Expected: the existing schemas pass or the failure identifies an already-present contract mismatch; do not change unrelated schemas.

- [ ] **Step 3: Export any missing public schema types**

Keep the existing barrel style in `packages/types/src/index.ts`; export `Schemas` and the existing domain/API types without introducing duplicate interfaces.

- [ ] **Step 4: Run typecheck and commit only this contract slice**

Run: `pnpm --filter @jobpilot/types typecheck`

Expected: `tsc --noEmit` exits 0.

```bash
git add packages/types/src/schemas/index.ts packages/types/src/schemas/index.test.ts packages/types/src/index.ts
git commit -m "test: lock student api contracts"
```

---

## Task 2: Add the real student dashboard aggregate API

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.repository.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.routes.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.repository.test.ts`
- Modify: `apps/api/src/routes/v1.ts`

**Interfaces:**
- Consumes: authenticated `req.user.id`, `User`, `Job`, `Application`, `Resume`, `MatchAnalysis`, and `Reminder` records.
- Produces: `GET /api/v1/dashboard/summary` returning `{ metrics, recommendedJobs, attentionItems }`.

Use this response shape:

```ts
export interface DashboardSummary {
  metrics: {
    strongMatches: number;
    activeApplications: number;
    resumeHealth: number | null;
    pendingActions: number;
  };
  recommendedJobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string | null;
    sourcePlatform: string;
    compatibility: number | null;
    matchId: string | null;
  }>;
  attentionItems: Array<{
    kind: 'REMINDER' | 'PARSING' | 'MATCH';
    id: string;
    label: string;
    href: string;
  }>;
}
```

- [ ] **Step 1: Write repository tests with mocked Prisma calls**

Test that the repository always includes `userId` in application, resume, match, and reminder filters; test that an empty account returns zero metrics and empty arrays.

- [ ] **Step 2: Implement aggregate queries**

Use `Promise.all` for independent counts. Active applications are all statuses except `REJECTED`, `WITHDRAWN`, and `GHOSTED`. Resume health is the newest completed `ResumeAnalysis.overallScore`, or `null`. Strong matches are completed `MatchAnalysis` rows with `compatibility >= 80` for the user. Recommended jobs are the newest completed matches joined to active jobs, limited to five.

- [ ] **Step 3: Add the route and service**

The route must use `requireAuth` and `attachUserId`, call `dashboardService.summary(req.user.id)`, and return `{ success: true, data }`.

- [ ] **Step 4: Run API tests and typecheck**

Run: `pnpm --filter @jobpilot/api test -- dashboard.repository.test.ts`

Expected: PASS.

Run: `pnpm --filter @jobpilot/api typecheck`

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard apps/api/src/routes/v1.ts
git commit -m "feat(api): add student dashboard summary"
```

---

## Task 3: Complete job discovery for real records

**Files:**
- Create: `apps/api/src/modules/jobs/job.repository.test.ts`
- Create: `apps/web/src/features/jobs/api.ts`
- Create: `apps/web/src/features/jobs/components/job-search.tsx`
- Create: `apps/web/src/features/jobs/components/job-card.tsx`
- Create: `apps/web/src/features/jobs/components/job-detail.tsx`
- Create: `apps/web/src/app/(student)/jobs/page.tsx`
- Create: `apps/web/src/app/(student)/jobs/[id]/page.tsx`
- Modify: `apps/api/src/modules/jobs/job.repository.ts`
- Modify: `apps/api/src/modules/jobs/job.service.ts`
- Modify: `apps/api/src/modules/jobs/job.routes.ts`

**Interfaces:**
- Consumes: `ListJobsQuerySchema`, `Job`, and the authenticated jobs API.
- Produces: query-string-safe job search and a job detail page with save/apply/match actions.

- [ ] **Step 1: Test search behavior**

Cover title/company/description search, platform filtering, skills filtering, inactive-job exclusion, pagination, and descending posted-date ordering.

- [ ] **Step 2: Implement search improvements**

Keep the existing `jobRepository.list(query)` signature. Normalize query text with `trim`, map skills to lowercase, and treat `postedAt: null` as older than dated jobs when sorting newest-first. Never return `isActive: false` records from the student list.

- [ ] **Step 3: Implement the web API client**

```ts
export interface JobFilters {
  q?: string;
  platform?: string;
  location?: string;
  remote?: boolean;
  skills?: string[];
  page?: number;
  pageSize?: number;
}

export const jobsApi = {
  list: (token: string | null, filters: JobFilters) =>
    apiFetch<PaginatedResult<Job>>(`/jobs${toQuery(filters)}`, { token }),
  get: (token: string | null, id: string) => apiFetch<Job>(`/jobs/${id}`, { token }),
};
```

- [ ] **Step 4: Build the search and detail components**

Use controlled search input, source/location/remote filters, explicit loading skeletons, an empty state, and an error retry button. Each job card must display title, company, source, location, posted date, and real salary data when present. The detail page must use the job’s `applyUrl`; never invent an application URL.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @jobpilot/api test -- job.repository.test.ts`

Expected: PASS.

Run: `pnpm --filter @jobpilot/web typecheck`

Expected: `tsc --noEmit` exits 0.

```bash
git add apps/api/src/modules/jobs apps/web/src/features/jobs apps/web/src/app/(student)/jobs
git commit -m "feat: add real student job discovery"
```

---

## Task 4: Add the student navigation shell and Command Center

**Files:**
- Create: `apps/web/src/components/student/student-shell.tsx`
- Create: `apps/web/src/features/dashboard/api.ts`
- Create: `apps/web/src/app/(student)/layout.tsx`
- Create: `apps/web/src/app/(student)/dashboard/page.tsx`
- Create: `apps/web/src/app/(student)/dashboard/dashboard-client.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/applications/page.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Consumes: `GET /dashboard/summary`, existing application board components, Clerk `auth()`/`currentUser()`.
- Produces: responsive student shell with Home, Jobs, Applications, Resume Lab, and Settings navigation.

- [ ] **Step 1: Add the dashboard API client**

```ts
export const dashboardApi = {
  summary: (token: string | null) => apiFetch<DashboardSummary>('/dashboard/summary', { token }),
};
```

- [ ] **Step 2: Write the shell**

Render the signed-in user name from Clerk, navigation links, a mobile menu, and a main content slot. Do not render recruiter terminology. Keep `/applications` as the existing board entry point.

- [ ] **Step 3: Build real dashboard sections**

Render metric cards from `summary.metrics`, recommended job cards from `summary.recommendedJobs`, and attention items from `summary.attentionItems`. If a metric is `null`, show “Not analyzed” rather than `0`.

- [ ] **Step 4: Apply the approved visual direction**

Use the A+B hybrid: dark command center, job discovery search as the primary action, restrained gradients, strong typography, and CSS-only motion with `@media (prefers-reduced-motion: reduce)` disabling transitions.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @jobpilot/web typecheck`

Expected: `tsc --noEmit` exits 0.

Run: `pnpm --filter @jobpilot/web build`

Expected: Next.js production build completes successfully.

```bash
git add apps/web/src/components/student apps/web/src/features/dashboard apps/web/src/app/'(student)' apps/web/src/app/dashboard apps/web/src/app/applications apps/web/src/app/globals.css apps/web/src/app/layout.tsx
git commit -m "feat(web): add student command center"
```

---

## Task 5: Complete authenticated Resume Lab API and UI

**Files:**
- Create: `apps/api/src/modules/resume/resume.routes.ts`
- Create: `apps/api/src/modules/resume/resume.controller.ts`
- Create: `apps/api/src/modules/resume/resume.routes.test.ts`
- Create: `apps/web/src/features/resumes/api.ts`
- Create: `apps/web/src/features/resumes/components/resume-uploader.tsx`
- Create: `apps/web/src/features/resumes/components/resume-status.tsx`
- Create: `apps/web/src/app/(student)/resume/page.tsx`
- Create: `apps/web/src/app/(student)/resume/[id]/page.tsx`
- Modify: `apps/api/src/routes/v1.ts`
- Modify: `apps/api/src/modules/resume/resume.service.ts`
- Modify: `apps/api/src/modules/resume/resume.repository.ts`

**Interfaces:**
- Consumes: `resumeService.createUpload`, `ingest`, `list`, `get`, `downloadUrl`, `remove`, and the existing `resume-parse` queue.
- Produces: authenticated routes:
  - `POST /resumes/upload-ticket`
  - `POST /resumes/:id/ingest`
  - `GET /resumes`
  - `GET /resumes/:id`
  - `GET /resumes/:id/download`
  - `DELETE /resumes/:id`

- [ ] **Step 1: Write route ownership tests**

Assert that a user cannot read, ingest, download, or delete another user’s resume. Assert that a valid upload ticket creates a `PENDING` row and returns a presigned `PUT` URL.

- [ ] **Step 2: Add controller and routes**

Use `requireAuth`, `attachUserId`, existing Zod validation, `asyncHandler`, and the current service. The download route returns `{ success: true, data: { url } }`; it does not stream private storage through Express.

- [ ] **Step 3: Build the browser upload flow**

```ts
const ticket = await resumesApi.createUpload(token, metadata);
await fetch(ticket.upload.url, {
  method: ticket.upload.method,
  headers: ticket.upload.headers,
  body: file,
});
await resumesApi.ingest(token, ticket.resume.id);
```

Show `PENDING -> UPLOADED -> PARSING -> PARSED` and `FAILED` states. Poll only while processing, with a bounded retry window and a manual refresh action.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @jobpilot/api test -- resume.routes.test.ts`

Expected: PASS.

Run: `pnpm --filter @jobpilot/web typecheck`

Expected: `tsc --noEmit` exits 0.

```bash
git add apps/api/src/modules/resume/resume.routes.ts apps/api/src/modules/resume/resume.controller.ts apps/api/src/modules/resume/resume.routes.test.ts apps/api/src/routes/v1.ts apps/web/src/features/resumes apps/web/src/app/'(student)'/resume
git commit -m "feat: complete student resume lab"
```

---

## Task 6: Make transparent matching usable from job details

**Files:**
- Create: `apps/api/src/modules/ai/match.service.test.ts`
- Create: `apps/web/src/features/matches/api.ts`
- Create: `apps/web/src/features/matches/components/match-breakdown.tsx`
- Modify: `apps/api/src/modules/ai/match.service.ts`
- Modify: `apps/api/src/modules/ai/match.controller.ts`
- Modify: `apps/api/src/modules/ai/match.repository.ts`
- Modify: `apps/web/src/app/(student)/jobs/[id]/page.tsx`
- Modify: `apps/web/src/app/(student)/resume/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /ai/match`, `GET /ai/match/:id`, `MatchAnalysis` queue worker, and the student’s own resumes.
- Produces: a job-detail “Analyze my fit” action and evidence-based match display.

- [ ] **Step 1: Test ownership and idempotency**

Test that a match request rejects another user’s resume, resolves a job description from `jobId`, and returns an existing completed analysis for the same user/resume/job when one exists instead of creating duplicate work.

- [ ] **Step 2: Implement safe reuse**

Before creating a new `MatchAnalysis`, query the user-owned resume/job pair for the newest completed result. Reuse it only when the stored job description and resume `updatedAt` represent the current inputs; otherwise create a new queued analysis.

- [ ] **Step 3: Add the match client and display**

Render score, readiness, strengths, missing skills, suggestions, and `breakdown` evidence. Show `QUEUED`/`RUNNING` with polling, `FAILED` with retry, and `COMPLETED` with the actual timestamp/model.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @jobpilot/api test -- match.service.test.ts`

Expected: PASS.

Run: `pnpm --filter @jobpilot/web typecheck`

Expected: `tsc --noEmit` exits 0.

```bash
git add apps/api/src/modules/ai apps/web/src/features/matches apps/web/src/app/'(student)'/jobs apps/web/src/app/'(student)'/resume
git commit -m "feat: expose transparent job matching"
```

---

## Task 7: Finish application actions, cover letters, reminders, and analytics

**Files:**
- Create: `apps/api/src/modules/applications/application.service.test.ts`
- Create: `apps/web/src/features/applications/components/application-insights.tsx`
- Create: `apps/web/src/features/cover-letters/api.ts`
- Create: `apps/web/src/features/cover-letters/components/cover-letter-panel.tsx`
- Modify: `apps/api/src/modules/applications/application.service.ts`
- Modify: `apps/api/src/modules/applications/application.repository.ts`
- Modify: `apps/api/src/modules/applications/note.service.ts`
- Modify: `apps/api/src/modules/applications/reminder.service.ts`
- Modify: `apps/web/src/features/applications/components/application-drawer.tsx`
- Modify: `apps/web/src/app/'(student)'/applications/page.tsx`

**Interfaces:**
- Consumes: existing application board, notes, reminders, events, and cover-letter queue contracts.
- Produces: reliable save/apply/status/note/reminder actions and real application metrics.

- [ ] **Step 1: Test application ownership and event creation**

Cover create, move, status update, note creation, reminder creation, and delete. Each mutation must scope by user-owned application and create the corresponding `ApplicationEvent`.

- [ ] **Step 2: Complete cover-letter API usage**

Add the client calls for the existing cover-letter creation/status/detail endpoints. If the API endpoint is missing, add it beside the resume module and enqueue `CoverLetterJob`; do not call Gemini directly from a request handler.

- [ ] **Step 3: Add application insights**

Compute persisted counts by status, upcoming reminder count, and the most recent activity. Render empty states when the user has no applications.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @jobpilot/api test -- application.service.test.ts`

Expected: PASS.

Run: `pnpm --filter @jobpilot/web typecheck`

Expected: `tsc --noEmit` exits 0.

```bash
git add apps/api/src/modules/applications apps/web/src/features/applications apps/web/src/features/cover-letters apps/web/src/app/'(student)'/applications
git commit -m "feat: complete student application workflow"
```

---

## Task 8: Full verification and release hardening

**Files:**
- Modify: `README.md`
- Modify: `.env.example` only if newly required variables are discovered during implementation.
- Create: `apps/web/src/app/error.tsx` or route-specific error files only where existing routes lack recovery UI.

- [ ] **Step 1: Run formatting and static checks**

Run: `pnpm format:check`

Expected: all files pass Prettier.

Run: `pnpm lint`

Expected: all workspaces exit 0 with zero warnings.

Run: `pnpm typecheck`

Expected: all workspaces exit 0.

- [ ] **Step 2: Run API tests and production build**

Run: `pnpm test`

Expected: all Vitest suites pass.

Run: `pnpm build`

Expected: Turbo builds all packages and both applications successfully.

- [ ] **Step 3: Update the README**

Document the student-only product scope, real-data route additions, resume upload prerequisites, scraper source configuration, and the worker command:

```bash
pnpm --filter @jobpilot/api dev:worker
```

- [ ] **Step 4: Review the final diff**

Run: `git diff --check` and `git status --short`. Confirm unrelated pre-existing resume queue changes are either explicitly integrated in their own commit or remain unstaged and are reported.

- [ ] **Step 5: Commit release hardening**

```bash
git add README.md .env.example apps/web/src/app
git commit -m "chore: harden student mvp release"
```
