# JobPilot AI

AI-powered job tracking platform. Track applications, scrape postings, match resumes with Gemini.

## Stack

| Layer       | Tech                                                      |
| ----------- | --------------------------------------------------------- |
| Frontend    | Next.js 15 (App Router) · TypeScript · Tailwind · shadcn  |
| Backend     | Express · TypeScript · Zod · Pino · Helmet                |
| Database    | PostgreSQL 16 · Prisma 5                                  |
| Cache/Queue | Redis 7 · BullMQ                                          |
| Auth        | Clerk                                                     |
| AI          | Google Gemini                                             |
| Scraping    | Playwright (Chromium)                                     |
| Build       | Turborepo · pnpm workspaces                               |
| Container   | Docker · docker compose                                   |
| CI          | GitHub Actions                                            |

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
```

## Scripts (root)

| Script             | Description                              |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | Run all apps in watch mode               |
| `pnpm build`       | Build all apps + packages                |
| `pnpm lint`        | ESLint, all workspaces                   |
| `pnpm typecheck`   | `tsc --noEmit` everywhere                |
| `pnpm test`        | Vitest, all workspaces                   |
| `pnpm format`      | Prettier write                           |
| `pnpm db:migrate`  | Prisma migrate dev                       |
| `pnpm db:studio`   | Prisma Studio                            |
| `pnpm db:seed`     | Seed demo data                           |
| `pnpm docker:up`   | Full stack via `docker compose up`       |
| `pnpm docker:down` | Tear down                                |

## Environment variables

See [`.env.example`](./.env.example). Each app validates its own slice with Zod at startup — invalid env throws before the server binds, so misconfig fails loud.

| Var                                   | Used by  | Notes                       |
| ------------------------------------- | -------- | --------------------------- |
| `DATABASE_URL`                        | api, db  | Postgres connection         |
| `REDIS_URL`                           | api      | BullMQ + rate limit store   |
| `CLERK_SECRET_KEY`                    | api, web | Server-side Clerk           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | web      | Client-side Clerk           |
| `CLERK_WEBHOOK_SECRET`                | api      | Verify Clerk webhooks       |
| `GEMINI_API_KEY`                      | api      | Google Generative AI        |
| `CORS_ORIGINS`                        | api      | Comma-separated allow-list  |
| `RATE_LIMIT_WINDOW_MS` / `_MAX`       | api      | Per-IP throttle             |
| `SCRAPER_HEADLESS`                    | api      | Playwright headless toggle  |

## API surface (v1)

```
GET    /health                     # liveness
GET    /health/ready                # readiness (db + redis)
GET    /api/v1/users/me             # current user
GET    /api/v1/applications         # list (paginated, filterable)
POST   /api/v1/applications         # create
GET    /api/v1/applications/:id     # get
PATCH  /api/v1/applications/:id     # update
DELETE /api/v1/applications/:id     # delete
POST   /api/v1/ai/analyze-resume    # Gemini resume↔job match
POST   /api/v1/scrape/jobs          # Playwright scrape + persist
POST   /webhooks/clerk              # Clerk user sync
```

Every response: `{ success: true, data: ... }` or `{ success: false, error: { code, message, details, requestId } }`.

## Docker

```bash
docker compose up --build
```

Brings up: Postgres → Redis → API → Web. Healthchecks gate dependencies. API image extends `mcr.microsoft.com/playwright` so scraping works out of the box.

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
