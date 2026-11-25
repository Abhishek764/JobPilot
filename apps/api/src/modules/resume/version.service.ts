import { prisma, type ResumeVersion } from '@jobpilot/db';

import { logger } from '../../config/logger';
import { assertAiQuota } from '../../shared/ai-quota';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { aiService } from '../ai/ai.service';
import { enqueueResumeVersion } from '../queue/queues';
import { userService } from '../users/user.service';

export interface CreateVersionRequest {
  jobId?: string;
  jobDescription?: string;
  analysisId?: string;
  label?: string;
}

const resolveTarget = async (
  input: CreateVersionRequest,
): Promise<{ jobId: string | null; jobDescription: string; label: string }> => {
  if (input.jobId) {
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job) throw new NotFoundError('Job');
    const text = job.description?.trim() || input.jobDescription?.trim();
    if (!text) throw new BadRequestError('This job has no description; paste one to tailor');
    return {
      jobId: job.id,
      jobDescription: text,
      label: input.label?.trim() || `${job.title} — ${job.company}`,
    };
  }
  const text = input.jobDescription?.trim();
  if (!text) throw new BadRequestError('jobId or jobDescription is required');
  return { jobId: null, jobDescription: text, label: input.label?.trim() || 'Tailored version' };
};

export const versionService = {
  /** Validate ownership + target job, persist a QUEUED version, and hand off to the worker. */
  async create(
    clerkUserId: string,
    resumeId: string,
    input: CreateVersionRequest,
  ): Promise<ResumeVersion> {
    const user = await userService.getByClerkId(clerkUserId);
    const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
    if (!resume) throw new NotFoundError('Resume');
    if (!resume.content.trim()) {
      throw new BadRequestError('Resume has no extracted text yet — wait for parsing to finish');
    }

    await assertAiQuota('resumeVersion', user.id);
    const target = await resolveTarget(input);
    const version = await prisma.resumeVersion.create({
      data: {
        userId: user.id,
        resumeId,
        analysisId: input.analysisId ?? null,
        jobId: target.jobId,
        jobDescription: target.jobDescription,
        label: target.label,
        status: 'QUEUED',
      },
    });
    try {
      await enqueueResumeVersion({ versionId: version.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.resumeVersion.update({
        where: { id: version.id },
        data: { status: 'FAILED', error: `Could not queue version: ${message}` },
      });
      throw err;
    }
    return prisma.resumeVersion.update({
      where: { id: version.id },
      data: { queueJobId: version.id },
    });
  },

  /** Worker body: idempotent, persists FAILED only on the final queue attempt. */
  async process(id: string, opts: { finalAttempt?: boolean } = {}): Promise<ResumeVersion> {
    const finalAttempt = opts.finalAttempt ?? true;
    const version = await prisma.resumeVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundError('Resume version');
    if (version.status === 'COMPLETED') return version;

    const resume = await prisma.resume.findUnique({ where: { id: version.resumeId } });
    if (!resume || !version.jobDescription) {
      return prisma.resumeVersion.update({
        where: { id },
        data: {
          status: 'FAILED',
          error: resume ? 'Missing job description' : 'Resume no longer exists',
        },
      });
    }

    await prisma.resumeVersion.update({ where: { id }, data: { status: 'RUNNING', error: null } });
    try {
      const out = await aiService.tailorResume({
        resumeContent: resume.content,
        jobDescription: version.jobDescription,
        userId: version.userId,
      });
      return await prisma.resumeVersion.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          markdown: out.markdown,
          model: out.model,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
          costUsd: out.costUsd,
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ versionId: id, err: message, finalAttempt }, 'resume tailoring failed');
      await prisma.resumeVersion.update({
        where: { id },
        data: { status: finalAttempt ? 'FAILED' : 'QUEUED', error: message },
      });
      throw err;
    }
  },
};
