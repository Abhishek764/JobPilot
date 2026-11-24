import { prisma, type CoverLetter } from '@jobpilot/db';
import type { CoverLetterTone } from '@jobpilot/types';

import { logger } from '../../config/logger';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { aiService } from '../ai/ai.service';
import { enqueueCoverLetter } from '../queue/queues';
import { userService } from '../users/user.service';

export interface CreateCoverLetterRequest {
  jobId?: string;
  jobDescription?: string;
  tone: CoverLetterTone;
}

const resolveJobDescription = async (
  input: CreateCoverLetterRequest,
): Promise<{ jobId: string | null; jobDescription: string }> => {
  if (input.jobId) {
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job) throw new NotFoundError('Job');
    const jd = job.description?.trim() || input.jobDescription?.trim();
    if (!jd) throw new BadRequestError('This job has no description; paste one to generate a letter');
    return { jobId: job.id, jobDescription: jd };
  }
  const jd = input.jobDescription?.trim();
  if (!jd) throw new BadRequestError('jobId or jobDescription is required');
  return { jobId: null, jobDescription: jd };
};

export const coverLetterService = {
  /** Validate ownership + inputs, persist a QUEUED letter, and hand generation to the worker. */
  async create(clerkUserId: string, resumeId: string, input: CreateCoverLetterRequest): Promise<CoverLetter> {
    const user = await userService.getByClerkId(clerkUserId);
    const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
    if (!resume) throw new NotFoundError('Resume');
    if (!resume.content.trim()) {
      throw new BadRequestError('Resume has no extracted text yet — wait for parsing to finish');
    }

    const { jobId, jobDescription } = await resolveJobDescription(input);
    const letter = await prisma.coverLetter.create({
      data: { userId: user.id, resumeId, jobId, jobDescription, tone: input.tone, status: 'QUEUED' },
    });
    await enqueueCoverLetter({ coverLetterId: letter.id });
    return prisma.coverLetter.update({ where: { id: letter.id }, data: { queueJobId: letter.id } });
  },

  async get(clerkUserId: string, id: string): Promise<CoverLetter> {
    const user = await userService.getByClerkId(clerkUserId);
    const letter = await prisma.coverLetter.findFirst({ where: { id, userId: user.id } });
    if (!letter) throw new NotFoundError('Cover letter');
    return letter;
  },

  async list(clerkUserId: string, filter: { jobId?: string; resumeId?: string }): Promise<CoverLetter[]> {
    const user = await userService.getByClerkId(clerkUserId);
    return prisma.coverLetter.findMany({
      where: {
        userId: user.id,
        ...(filter.jobId ? { jobId: filter.jobId } : {}),
        ...(filter.resumeId ? { resumeId: filter.resumeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  },

  /** Worker body. Idempotent: COMPLETED letters short-circuit; failures are persisted then rethrown. */
  async process(id: string): Promise<CoverLetter> {
    const letter = await prisma.coverLetter.findUnique({ where: { id } });
    if (!letter) throw new NotFoundError('Cover letter');
    if (letter.status === 'COMPLETED') return letter;

    const resume = await prisma.resume.findUnique({ where: { id: letter.resumeId } });
    if (!resume) {
      return prisma.coverLetter.update({ where: { id }, data: { status: 'FAILED', error: 'Resume no longer exists' } });
    }
    const [user, job] = await Promise.all([
      prisma.user.findUnique({ where: { id: letter.userId } }),
      letter.jobId ? prisma.job.findUnique({ where: { id: letter.jobId } }) : Promise.resolve(null),
    ]);

    await prisma.coverLetter.update({ where: { id }, data: { status: 'RUNNING', error: null } });
    try {
      const out = await aiService.generateCoverLetter({
        resumeContent: resume.content,
        jobDescription: letter.jobDescription ?? job?.description ?? '',
        tone: letter.tone as CoverLetterTone,
        candidateName: user?.name ?? null,
        company: job?.company ?? null,
        role: job?.title ?? null,
        userId: letter.userId,
      });
      return await prisma.coverLetter.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          content: out.content,
          model: out.model,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
          costUsd: out.costUsd,
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ coverLetterId: id, err: message }, 'cover letter generation failed');
      await prisma.coverLetter.update({ where: { id }, data: { status: 'FAILED', error: message } });
      throw err;
    }
  },
};
