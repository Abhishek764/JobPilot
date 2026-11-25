import { prisma, type Prisma, type ResumeAnalysis } from '@jobpilot/db';

import { logger } from '../../config/logger';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { aiService } from '../ai/ai.service';
import { enqueueResumeAnalysis } from '../queue/queues';
import { userService } from '../users/user.service';

export interface CreateAnalysisRequest {
  jobId?: string;
  jobDescription?: string;
}

/** Job text to analyse against, or null for an ATS-only pass. */
const resolveJobDescription = async (
  input: CreateAnalysisRequest,
): Promise<{ jobId: string | null; jobDescription: string | null }> => {
  if (input.jobId) {
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job) throw new NotFoundError('Job');
    return {
      jobId: job.id,
      jobDescription: job.description?.trim() || input.jobDescription?.trim() || null,
    };
  }
  return { jobId: null, jobDescription: input.jobDescription?.trim() || null };
};

export const analysisService = {
  /** Validate ownership, persist a QUEUED analysis, and hand the AI work to the worker. */
  async create(
    clerkUserId: string,
    resumeId: string,
    input: CreateAnalysisRequest,
  ): Promise<ResumeAnalysis> {
    const user = await userService.getByClerkId(clerkUserId);
    const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
    if (!resume) throw new NotFoundError('Resume');
    if (!resume.content.trim()) {
      throw new BadRequestError('Resume has no extracted text yet — wait for parsing to finish');
    }

    const { jobId, jobDescription } = await resolveJobDescription(input);
    const analysis = await prisma.resumeAnalysis.create({
      data: { userId: user.id, resumeId, jobId, jobDescription, status: 'QUEUED' },
    });
    try {
      await enqueueResumeAnalysis({ analysisId: analysis.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.resumeAnalysis.update({
        where: { id: analysis.id },
        data: { status: 'FAILED', error: `Could not queue analysis: ${message}` },
      });
      throw err;
    }
    return prisma.resumeAnalysis.update({
      where: { id: analysis.id },
      data: { queueJobId: analysis.id },
    });
  },

  /** Worker body: idempotent, persists FAILED only on the final queue attempt. */
  async process(id: string, opts: { finalAttempt?: boolean } = {}): Promise<ResumeAnalysis> {
    const finalAttempt = opts.finalAttempt ?? true;
    const analysis = await prisma.resumeAnalysis.findUnique({ where: { id } });
    if (!analysis) throw new NotFoundError('Resume analysis');
    if (analysis.status === 'COMPLETED') return analysis;

    const resume = await prisma.resume.findUnique({ where: { id: analysis.resumeId } });
    if (!resume) {
      return prisma.resumeAnalysis.update({
        where: { id },
        data: { status: 'FAILED', error: 'Resume no longer exists' },
      });
    }

    await prisma.resumeAnalysis.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date(), error: null },
    });
    try {
      const started = Date.now();
      const out = await aiService.analyzeResume({
        resumeContent: resume.content,
        jobDescription: analysis.jobDescription,
        userId: analysis.userId,
      });
      await prisma.resume.update({ where: { id: resume.id }, data: { atsScore: out.atsScore } });
      return await prisma.resumeAnalysis.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          atsScore: out.atsScore,
          keywordScore: out.keywordScore,
          overallScore: out.overallScore,
          matchedKeywords: out.matchedKeywords,
          missingKeywords: out.missingKeywords,
          strengths: out.strengths,
          weaknesses: out.weaknesses,
          suggestions: out.suggestions as unknown as Prisma.InputJsonValue,
          atsIssues: out.atsIssues as unknown as Prisma.InputJsonValue,
          model: out.model,
          tokensIn: out.tokensIn,
          tokensOut: out.tokensOut,
          costUsd: out.costUsd,
          durationMs: Date.now() - started,
          completedAt: new Date(),
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ analysisId: id, err: message, finalAttempt }, 'resume analysis failed');
      await prisma.resumeAnalysis.update({
        where: { id },
        data: { status: finalAttempt ? 'FAILED' : 'QUEUED', error: message },
      });
      throw err;
    }
  },
};
