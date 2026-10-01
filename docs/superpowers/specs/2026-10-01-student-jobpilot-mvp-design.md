# JobPilot AI Student MVP Design

**Date:** 2026-10-01  
**Status:** Approved for implementation  
**Scope:** Student/job-seeker experience only

## 1. Product mission

JobPilot AI is a student-first AI job-search operating system. It helps students discover relevant opportunities, understand their fit, improve their applications, and stay organized until they get hired.

The product principle is:

> Automate the repetitive. Explain the intelligent. Keep students in control.

This phase does not build recruiter, company, hiring-manager, or employer workflows.

## 2. MVP boundary

### In scope

- Student onboarding and profile
- Real job ingestion from LinkedIn, Wellfound, Indeed, and Naukri
- Normalized job search and filtering
- Resume upload for PDF, DOCX, and TXT
- Resume parsing and structured profile extraction
- Resume analysis, ATS feedback, and resume versions
- Transparent resume-to-job matching
- Match score, strengths, missing skills, evidence, and suggestions
- Application Kanban board and application history
- Notes, reminders, and activity events
- AI cover-letter generation
- Dashboard analytics based on persisted records
- Source and processing status visibility

### Explicitly out of scope

- Recruiter dashboards
- Company accounts and employer pipelines
- Candidate screening agents
- Hiring-manager collaboration
- Recruiter communication center
- Autonomous hiring decisions
- Employer-side multi-tenancy and permissions

## 3. Existing architecture

The implementation preserves the existing monorepo:

```text
Next.js 15 student web app
        |
        v
Express TypeScript API (/api/v1)
        |
        +--> Prisma + PostgreSQL
        +--> Redis + BullMQ workers
        +--> Playwright scrapers
        +--> Resume storage/parser
        +--> Gemini AI services
```

The existing Clerk authentication, Prisma data model, application board, scraper modules, resume modules, queues, AI matching, and storage work are extended rather than replaced.

## 4. Product experience

The primary experience is a hybrid of:

1. **Command Center:** a clear overview of real matches, application momentum, resume health, and next actions.
2. **Job Discovery First:** natural-language search and transparent recommendations remain the dominant action.

Primary navigation:

- Home
- Jobs
- Applications
- Resume Lab
- Profile/settings

Core routes:

- `/` — student landing page
- `/dashboard` — Command Center and job discovery
- `/jobs` — searchable normalized jobs
- `/jobs/[id]` — job detail, match explanation, save/apply
- `/applications` — application Kanban board
- `/applications/[id]` — notes, reminders, events, cover letter
- `/resume` — upload, parse status, health, versions
- `/resume/[id]/match/[jobId]` — detailed match analysis
- `/settings` — profile and search preferences

Every screen has explicit loading, empty, error, retry, and processing states.

## 5. Data model and ownership

The MVP builds on the existing student-centric models:

- `User` — student identity, skills, role preferences, location, experience
- `Job` — normalized scraped listing
- `Application` — student relationship to a job
- `ApplicationEvent` — status and activity history
- `ApplicationNote` — student notes
- `Reminder` — follow-ups
- `Resume` — uploaded and parsed resume
- `ResumeAnalysis` — resume quality and ATS analysis
- `ResumeVersion` — optimized resume versions
- `CoverLetter` — generated cover letters
- `MatchAnalysis` — persisted transparent matching result
- `AiUsage` and `AiCache` — AI telemetry and caching
- `ScrapeSource` and `ScrapeRun` — source configuration and ingestion telemetry

All student records are scoped by the authenticated `userId`. Applications reference normalized jobs. Match analyses are tied to the exact resume and job records used to produce them. Dashboard metrics use database aggregates only.

Schema additions are minimal and only introduced when required for saved searches, search history, match metadata/versioning, or job freshness/visibility.

## 6. Workflows

### Job discovery

```text
Scrape source -> normalize -> deduplicate -> persist Job
Student preferences -> search/filter -> job detail
Job detail + resume -> queued MatchAnalysis -> explanation
Student -> save/apply -> Application + ApplicationEvent
```

### Resume intelligence

```text
Upload -> storage record -> parse queue -> structured Resume fields
Resume -> analysis queue -> ResumeAnalysis
Resume + Job -> matching queue -> MatchAnalysis
```

### Application tracking

Every create, update, status move, note, reminder, and generated artifact is persisted. Kanban moves are optimistic in the UI but confirmed by the API and rolled back on failure.

## 7. AI behavior and safety

AI recommendations must be grounded in the student profile, resume content, and the actual job description. Every recommendation should expose:

- recommendation
- evidence
- confidence or score
- student-controlled next action

The system must not infer or use protected characteristics, including race, religion, gender identity, sexual orientation, health, disability, or political beliefs. AI must not make unexplained hiring decisions. Students can review, edit, retry, or ignore AI-generated content.

AI usage, latency, cache hits, token counts, cost, and failures remain observable through existing telemetry models.

## 8. Reliability and security

- Clerk authentication remains required for student data.
- API input validation remains Zod-based.
- Storage uploads remain validated by MIME type, size, and safe file-key handling.
- Queue failures remain persisted and retryable.
- Scraper failures are recorded without deleting previously valid jobs.
- AI failures show retryable UI states and never fabricate success.
- Database confirmation is required before reporting a write as successful.
- Existing request logging, error handling, rate limiting, and security middleware remain in use.

## 9. Delivery process

Implementation is incremental:

1. Verify and stabilize the current baseline.
2. Complete real job ingestion and student job discovery.
3. Build the Command Center around real aggregates.
4. Complete resume upload/parsing and Resume Lab.
5. Complete matching explanations and job detail flow.
6. Expand applications with notes, reminders, and cover letters.
7. Add student analytics, processing states, and polish.

After every logical slice:

1. Run the smallest meaningful tests.
2. Run typecheck/build checks appropriate to the slice.
3. Review the diff.
4. Commit with a conventional commit message.

No hardcoded dashboard or candidate data will be introduced.
