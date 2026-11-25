# Student MVP Completion & Free Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every known gap from the first MVP pass and ship the site on free infrastructure.

**Architecture:** Same feature-slice monorepo. Shared packages compile to `dist/` so the API runs as plain Node. Real jobs come from public job-board APIs (Remotive, Arbeitnow) alongside the existing Playwright scrapers. Resume analysis and tailored versions follow the existing queue → worker → persisted-row pattern. On free hosting the API runs the BullMQ workers in-process.

**Tech Stack:** Node 20+, TypeScript, Express, Prisma 5 / Neon Postgres, BullMQ / Redis (Render Key Value), Neon Object Storage (S3 API), Gemini, Next.js 15, Clerk, Render free web services.

**Spec:** `docs/superpowers/specs/2026-10-01-student-jobpilot-mvp-design.md`

## Global Constraints

- Student/job-seeker experience only; no recruiter or company workflows.
- Real PostgreSQL records only; no hardcoded dashboard or candidate data.
- All student records remain scoped by authenticated `userId`.
- AI output must expose evidence, score/confidence, and a student-controlled next action; never infer or use protected characteristics.
- Resume upload for PDF, DOCX, and TXT.
- Queue failures remain persisted and retryable; AI failures never fabricate success.
- Every hosting dependency must have a $0 tier with no card required for the user.
- No new abstractions beyond what a task needs. Commits use `--no-verify` until Task 2 lands.

## Review Focus

1. A DOCX whose text can't be extracted → resume FAILED with a readable error, not stuck in PARSING. (Task 5 test)
2. A job-board API that is down or returns malformed rows → sync records the failure and keeps existing jobs. (Task 3 test)
3. A student who starts many AI jobs in a short time → 429 after the hourly cap, with no rows created. (Task 6 test)
4. An API cold start on free hosting with `RUN_WORKERS=true` → workers start once and shut down cleanly. (Task 7 smoke)
5. Analysis results for a resume with no job given → ATS-only analysis completes, and resume health updates on the dashboard. (Task 4 test)

---

### Task 1: Production runtime for shared packages

**Files:** `packages/{types,logger,db}/package.json`, `packages/{types,logger,db}/tsconfig.build.json`, `apps/api/package.json`, `apps/api/vitest.config.ts`, `turbo.json`, `apps/api/Dockerfile`

**Interfaces:** Produces `exports` with conditions `{ types: src, source: src, default: dist }` and a `build` script for each package.

- [ ] Reproduce: `node -e "require('@jobpilot/types')"` from `apps/api` → `ERR_MODULE_NOT_FOUND` (already observed).
- [ ] Compile each package with `tsc -p tsconfig.build.json` to CJS `dist/`. Packages resolve to `dist` by default. API dev uses `tsx --conditions=source` and vitest uses `resolve.conditions: ['source']`, so neither needs a build. turbo `dev`/`test`/`typecheck` depend on `^build` only where needed.
- [ ] Verify: `pnpm build`, then from `apps/api`: `node -e "require('@jobpilot/types');require('@jobpilot/types/schemas');require('@jobpilot/logger');console.log('OK')"` → `OK`. Full test suite green.
- [ ] Fix the Dockerfile: build packages before `pnpm deploy`, and run `prisma generate` in the runtime image.
- [ ] Commit `fix: make shared packages runnable in production`.

### Task 2: ESLint flat config

**Files:** `eslint.config.mjs` (root), `packages/config/eslint/*.js` → flat exports, remove `**/.eslintrc.cjs`, `apps/web/package.json` lint script → `eslint .`

- [ ] Flat config: `typescript-eslint` recommended plus `eslint-config-prettier`, plus `@next/eslint-plugin-next` for web. Keep existing rules (`no-process-exit`).
- [ ] Verify: `pnpm lint` exits 0 with `--max-warnings 0`. Fix real findings; don't disable rules to pass.
- [ ] Commit `chore: migrate to eslint flat config`.

### Task 3: Real jobs from public job-board APIs

**Files:**
- Create: `apps/api/src/modules/jobs/feeds/{remotive,arbeitnow,index}.ts`, `apps/api/src/modules/jobs/feeds/feeds.test.ts`
- Modify: `packages/db/prisma/schema.prisma` (enum `SourcePlatform` + `REMOTIVE`, `ARBEITNOW`), `packages/types/src/domain/job.ts`, `apps/api/src/modules/queue/{queues,index}.ts`, a new `feed-sync.worker.ts`, `apps/api/src/modules/scraper/scraper.routes.ts`

**Interfaces:**
- `parseRemotive(json: unknown): NormalizedJob[]` and `parseArbeitnow(json: unknown): NormalizedJob[]` — pure functions that skip invalid rows.
- `syncFeeds(fetchImpl = fetch): Promise<{ platform; fetched; upserted; error? }[]>` upserts through `jobRepository.upsertNormalized`.
- Queue `feed-sync`, repeating every `FEED_SYNC_INTERVAL_HOURS` (default 6), plus an admin `POST /scrape/feeds/sync`.

- [ ] Tests:
  - A Remotive fixture maps title, company, url, apply url, `remote: true`, salary text kept out of the numeric fields, tags → skills (lowercased), and `postedAt`.
  - The parser skips rows missing a title, company or url.
  - `syncFeeds` with one feed throwing still syncs the other and reports `error`.
- [ ] Implement. Store descriptions as plain text (strip HTML tags and decode entities). The sources' terms require attribution: keep `source` set to `remotive.com` / `arbeitnow.com`, which the job card already shows.
- [ ] Commit `feat(api): ingest jobs from remotive and arbeitnow`.

### Task 4: Resume analysis (ATS feedback → resume health)

**Files:** `apps/api/src/modules/resume/analysis.service.ts` (+ test), `apps/api/src/modules/ai/ai.service.ts` (`analyzeResume`), `queue/workers/resume-analysis.worker.ts`, `resume.routes.ts`, web `features/resumes/components/resume-analysis.tsx`

**Interfaces:**
- `POST /resumes/:id/analyses` takes `CreateResumeAnalysisSchema` (optional `jobId` or `jobDescription`) and returns a QUEUED `ResumeAnalysis`.
- `analysisService.create(clerkId, resumeId, input)`, `.process(id, { finalAttempt })` — same ownership, enqueue-failure and retry rules as cover letters.
- `aiService.analyzeResume({ resumeContent, jobDescription? })` returns `{ atsScore, keywordScore|null, overallScore, matchedKeywords, missingKeywords, strengths, weaknesses, suggestions: ResumeSuggestion[], atsIssues: AtsIssue[] }` and clamps scores to 0–100.
- [ ] Tests:
  - Ownership.
  - Unparsed resume → 400.
  - ATS-only (no job) stores `keywordScore: null`.
  - Process stores scores and also sets `resume.atsScore`.
  - Retry semantics match cover letters.
- [ ] UI: an "Analyze resume" button on the resume detail page; the latest analysis shows scores, ATS issues and suggestions, with polling. The dashboard's `resumeHealth` now populates.
- [ ] Commit `feat: resume ATS analysis`.

### Task 5: DOCX and TXT uploads

**Files:** `packages/types/src/schemas/index.ts` (`contentType` enum), `resume.service.ts` (key extension), `resume.parser.ts` (`mammoth` for DOCX, UTF-8 for TXT), web uploader `accept`/validation, `resume.parser.test.ts`

- [ ] Tests:
  - DOCX buffer → `mammoth.extractRawText` used.
  - TXT decoded.
  - Unknown mime → FAILED "Unsupported file type".
  - Schema accepts the three mimes and rejects others.
- [ ] Commit `feat: accept docx and txt resumes`.

### Task 6: Deferred review minors

Each item gets a RED → GREEN test where the API is involved:
- [ ] Match create: when `jobId` is given, store and analyse `job.description`. Use pasted text only when the job has no description.
- [ ] `POST /applications` and cover letter with a missing `jobId` → 404 `Job`. Check before insert.
- [ ] Per-user AI cap: match, cover-letter, analysis and version creation → 429 `RATE_LIMITED` once the user has ≥ `AI_JOBS_PER_HOUR` (default 30) rows of that kind created in the last hour.
- [ ] Parser: storage/network errors rethrow, so BullMQ retries; FAILED only on the final attempt, same rule as the other workers.
- [ ] Orphans: `createUpload` deletes the row if presigning throws. The web uploader calls `DELETE /resumes/:id` when the browser PUT fails.
- [ ] Web: `?open=` follows `searchParams` changes; the drawer shows an error with Close when the application fails to load. Resume pickers request `pageSize=100`.
- [ ] Commit `fix: close review follow-ups`.

### Task 7: Tailored resume versions

**Files:** `apps/api/src/modules/resume/version.service.ts` (+ test), `aiService.tailorResume`, `resume-version.worker.ts`, routes, web section on the resume detail page

**Interfaces:** `POST /resumes/:id/versions` takes `CreateResumeVersionSchema` and returns QUEUED. The worker stores `markdown`. Rules: Markdown only, built from facts in the resume; nothing invented.

- [ ] Tests: ownership, a job is required, process stores markdown, retry semantics.
- [ ] UI: generate from a pasted JD or a saved job; view and copy the markdown.
- [ ] Commit `feat: tailored resume versions`.

### Task 8: Free-hosting mode & deploy artifacts

**Files:** `apps/api/src/server.ts` (`RUN_WORKERS` → start workers + feed schedule in-process), `apps/api/src/config/env.ts`, `packages/db/prisma/migrations/0001_init/migration.sql` (generated with `prisma migrate diff --from-empty`), `render.yaml`, README deploy section, `.env.example`

- [ ] `RUN_WORKERS=true` starts `startAllWorkers()` and the feed schedule in the API process and stops them on SIGTERM. Smoke test: built API boots against local env.
- [ ] Generate the baseline migration; the deploy runs `prisma migrate deploy`.
- [ ] `render.yaml` blueprint for two free web services (api, web).
- [ ] Commit `chore: free-tier deploy config`.

### Task 9: Deploy

- [ ] Neon: project, database and storage bucket (CORS for the web origin).
- [ ] Render: free Key Value with `noeviction`, then API and web services. The user supplies Clerk and Gemini keys.
- [ ] Run migrations, trigger the first feed sync, and smoke-test the live URLs.
