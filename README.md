# JobPilot AI

Student-first AI job search. Discover real listings, understand your fit against your own resume, and stay organized until you're hired.

> **Scope:** the student / job-seeker experience only. There are no recruiter, company or hiring-manager workflows. Every dashboard number and recommendation comes from persisted records — nothing is hardcoded.

## Student experience

| Route           | What it does                                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| `/dashboard`    | Command Center: strong matches, active applications, resume health, follow-ups |
| `/jobs`         | Search scraped listings (LinkedIn, Wellfound, Indeed, Naukri) with filters     |
| `/jobs/[id]`    | Job detail, apply link, save/applied tracking, "Analyze my fit"                |
| `/applications` | Kanban board, insights, notes, reminders, activity, cover letters              |
| `/resume`       | Resume Lab: PDF upload, parse status                                           |
| `/resume/[id]`  | Extracted skills/text, analyses, versions, job matches                         |
| `/settings`     | Profile and search preferences                                                 |

AI output always shows its evidence (strengths, gaps, score breakdown), a score, and a next step the student controls. Prompts are grounded in the resume and job text only and never use protected characteristics.

## Stack

| Layer       | Tech                                                     |
| ----------- | -------------------------------------------------------- |
| Frontend    | Next.js 15 (App Router) · TypeScript · Tailwind · shadcn |
| Backend     | Express · TypeScript · Zod · Pino · Helmet               |
| Database    | PostgreSQL 16 · Prisma 5                                 |
| Cache/Queue | Redis 7 · BullMQ                                         |
| Auth        | Clerk                                                    |
| AI          | Google Gemini                                            |
| Scraping    | Playwright (Chromium)                                    |
| Build       | Turborepo · pnpm workspaces                              |
| Container   | Docker · docker compose                                  |
| CI          | GitHub Actions                                           |

## Repo layout

```
jobpilot-ai/
├── apps/
│   ├── api/                       # Express backend
│   │   ├── src/
│   │   │   ├── config/            # env, logger, redis
│   │   │   ├── middleware/        # auth, error-handler, validate, rate-limit, request-context
│   │   │   ├── modules/           # feature slices: applications, ai, scraper, users, webhooks, queue
│   │   │   │   └── <feature>/
│   │   │   │       ├── *.routes.ts
│   │   │   │       ├── *.controller.ts
│   │   │   │       ├── *.service.ts
│   │   │   │       └── *.repository.ts
│   │   │   ├── routes/            # health, v1 aggregator
│   │   │   ├── shared/            # errors, async-handler
│   │   │   ├── app.ts             # express app factory
│   │   │   └── server.ts          # listen + graceful shutdown
│   │   └── Dockerfile
│   └── web/                       # Next.js 15
│       ├── src/
│       │   ├── app/               # App Router (sign-in, dashboard, ...)
│       │   ├── components/        # ui, providers
│       │   ├── lib/               # env, api-client, utils
│       │   └── middleware.ts      # Clerk route protection
│       └── Dockerfile
├── packages/
│   ├── config/                    # shared eslint + tsconfig
│   ├── db/                        # Prisma schema + generated client
│   ├── logger/                    # shared pino logger
│   └── types/                     # shared domain types + Zod schemas
├── .github/workflows/ci.yml       # lint · typecheck · test · build · docker
├── docker-compose.yml             # prod-ish stack
├── docker-compose.dev.yml         # local Postgres + Redis only
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Architecture

- **Clean architecture per feature.** Each `modules/<feature>` slice has `routes → controller → service → repository`. Repositories talk to Prisma; services hold business rules; controllers translate HTTP. No circular deps between modules.
- **Shared kernel.** `@jobpilot/types` exports both TS types and Zod schemas so frontend, backend, and DB layer agree.
- **Versioned API.** All routes mount at `/api/v1/...`. Adding `v2` is a new aggregator in `routes/`.
- **Errors.** Every handler is wrapped by `asyncHandler`. Custom `AppError` subclasses carry `statusCode + code`. Global `errorHandler` formats responses as `{ success: false, error: { code, message, details, requestId } }`.
- **Observability.** Pino with request-scoped child logger (`req.log`), request IDs propagated via `x-request-id` header, structured JSON in prod, pretty in dev. Redaction for auth/tokens.
- **Security.** Helmet, CORS allow-list, rate limiting (Redis store), Clerk JWT auth, Zod validation on every input.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker + Docker Compose
- Accounts: [Clerk](https://clerk.com), [Google AI Studio](https://aistudio.google.com) (Gemini key)

## Setup

```bash
# 1. install
pnpm install

# 2. copy env
cp .env.example .env
# fill in CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, GEMINI_API_KEY

# 3. start local infra (Postgres + Redis)
docker compose -f docker-compose.dev.yml up -d

# 4. generate Prisma client + run migrations
pnpm db:generate
pnpm db:migrate

# 5. seed (optional)
pnpm db:seed

# 6. install Playwright browser (one-time)
pnpm --filter @jobpilot/api exec playwright install chromium

# 7. dev (web on :3000, api on :4000)
pnpm dev

# 8. background workers (scraping, resume parsing, matching, cover letters) — separate terminal
pnpm --filter @jobpilot/api dev:worker
```

Parsing, matching and cover letters are queue-backed: without the worker running, they stay
`QUEUED` and the UI keeps showing a processing state.

### Resume uploads

Resumes go straight from the browser to S3-compatible storage through a presigned `PUT`; the API
never streams file bytes. You need:

1. A bucket plus `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_ENDPOINT` +
   `S3_FORCE_PATH_STYLE=true` for MinIO/R2). Without them, upload requests return
   `503 STORAGE_UNCONFIGURED`.
2. A bucket **CORS rule** allowing `PUT` from your web origin with the `content-type` header,
   e.g. for `http://localhost:3000`:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

Only PDF is accepted (max `RESUME_MAX_BYTES`, default 15 MB). Download links are short-lived
presigned URLs (`RESUME_URL_TTL_SECONDS`).

### Job sources

Scrapers for LinkedIn, Wellfound, Indeed and Naukri run in the worker. Configure what to scrape via
the admin endpoints (`ADMIN` role) — `POST /api/v1/scrape/sources` to upsert a source and
`POST /api/v1/scrape/runs` to trigger one — and set `SCRAPER_SCHEDULER_ENABLED=true` to run enabled
sources on their schedule. Failed scrapes are recorded in `ScrapeRun` without removing existing jobs.

## Scripts (root)

| Script             | Description                        |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | Run all apps in watch mode         |
| `pnpm build`       | Build all apps + packages          |
| `pnpm lint`        | ESLint, all workspaces             |
| `pnpm typecheck`   | `tsc --noEmit` everywhere          |
| `pnpm test`        | Vitest, all workspaces             |
| `pnpm format`      | Prettier write                     |
| `pnpm db:migrate`  | Prisma migrate dev                 |
| `pnpm db:studio`   | Prisma Studio                      |
| `pnpm db:seed`     | Seed demo data                     |
| `pnpm docker:up`   | Full stack via `docker compose up` |
| `pnpm docker:down` | Tear down                          |

## Environment variables

See [`.env.example`](./.env.example). Each app validates its own slice with Zod at startup — invalid env throws before the server binds, so misconfig fails loud.

| Var                                 | Used by  | Notes                      |
| ----------------------------------- | -------- | -------------------------- |
| `DATABASE_URL`                      | api, db  | Postgres connection        |
| `REDIS_URL`                         | api      | BullMQ + rate limit store  |
| `CLERK_SECRET_KEY`                  | api, web | Server-side Clerk          |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web      | Client-side Clerk          |
| `CLERK_WEBHOOK_SECRET`              | api      | Verify Clerk webhooks      |
| `GEMINI_API_KEY`                    | api      | Google Generative AI       |
| `CORS_ORIGINS`                      | api      | Comma-separated allow-list |
| `RATE_LIMIT_WINDOW_MS` / `_MAX`     | api      | Per-IP throttle            |
| `SCRAPER_HEADLESS`                  | api      | Playwright headless toggle |
| `SCRAPER_SCHEDULER_ENABLED`         | api      | Run scheduled scrapes      |
| `S3_*`                              | api      | Resume storage (see above) |
| `RESUME_MAX_BYTES`                  | api      | Upload size cap            |

## API surface (v1)

```
GET    /health                     # liveness
GET    /health/ready                # readiness (db + redis)
GET    /api/v1/users/me                 # current user
GET    /api/v1/dashboard/summary        # Command Center aggregates
GET    /api/v1/jobs                     # search (q, platform, location, remote, skills, page)
GET    /api/v1/jobs/:id                 # job detail
GET    /api/v1/applications             # list (paginated, filterable)
GET    /api/v1/applications/board       # Kanban columns
GET    /api/v1/applications/insights    # counts by status, follow-ups, latest activity
POST   /api/v1/applications             # create
GET    /api/v1/applications/:id         # get
PATCH  /api/v1/applications/:id         # update
PATCH  /api/v1/applications/:id/move    # drag-and-drop move
DELETE /api/v1/applications/:id         # delete
*      /api/v1/applications/:id/notes|reminders|events
POST   /api/v1/resumes/upload-ticket    # create resume + presigned PUT
POST   /api/v1/resumes/:id/ingest       # mark uploaded, queue parsing
GET    /api/v1/resumes                  # list
GET    /api/v1/resumes/:id              # detail with analyses, versions, cover letters
GET    /api/v1/resumes/:id/download     # presigned GET
DELETE /api/v1/resumes/:id              # delete row + stored objects
POST   /api/v1/resumes/:id/cover-letters  # queue a cover letter
GET    /api/v1/cover-letters[/:id]      # list (jobId, resumeId) / get
POST   /api/v1/ai/match                 # queue a resume↔job match (reuses unchanged results)
GET    /api/v1/ai/match[/:id]           # list (jobId, resumeId) / get
POST   /api/v1/ai/analyze-resume        # synchronous legacy match
POST   /api/v1/scrape/jobs              # Playwright scrape + persist
POST   /webhooks/clerk              # Clerk user sync
```

Every response: `{ success: true, data: ... }` or `{ success: false, error: { code, message, details, requestId } }`.

## Docker

```bash
docker compose up --build
```

Brings up: Postgres → Redis → API → Worker → Web. Healthchecks gate dependencies. API image extends `mcr.microsoft.com/playwright` so scraping works out of the box.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every PR:

1. **install** — pnpm with frozen lockfile + Prisma generate
2. **lint** — Prettier check + ESLint
3. **typecheck** — `tsc --noEmit`
4. **test** — Vitest with ephemeral Postgres + Redis services
5. **build** — Turbo build for both apps
6. **docker** — buildx for `api` + `web` images (matrix), with GHA cache

## License

Proprietary — internal project.
