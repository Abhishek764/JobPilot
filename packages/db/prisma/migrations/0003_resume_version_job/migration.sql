-- Tailored versions keep the job they were tailored for
ALTER TABLE "resume_versions" ADD COLUMN "jobId" TEXT;
ALTER TABLE "resume_versions" ADD COLUMN "jobDescription" TEXT;
