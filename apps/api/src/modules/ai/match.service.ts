import { prisma } from '@jobpilot/db';
import type { MatchAnalysis, MatchTrack } from '@jobpilot/db';

import { logger } from '../../config/logger';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { enqueueMatchAnalysis } from '../queue/queues';

import { aiService } from './ai.service';
import { matchRepository } from './match.repository';
import type { Track } from './ai.prompts';

export interface CreateMatchRequest {
  userId: string;
  resumeId: string;
  track: MatchTrack;
  jobId?: string;
  jobDescription?: string;
}

const ensureJobDescription = async (
  jobId: string | undefined,
  jobDescription: string | undefined,
): Promise<{ jobId: string | null; jobDescription: string }> => {
  if (jobDescription && jobDescription.trim().length >= 50) {
    return { jobId: jobId ?? null, jobDescription };
  }
  if (jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job?.description) throw new NotFoundError('Job description');
    return { jobId, jobDescription: job.description };
  }
  throw new BadRequestError('jobDescription or jobId required');
};

export const matchService = {
  async createAndEnqueue(req: CreateMatchRequest): Promise<MatchAnalysis> {
    const resume = await prisma.resume.findFirst({
      where: { id: req.resumeId, userId: req.userId },
    });
    if (!resume) throw new NotFoundError('Resume');

    const resolved = await ensureJobDescription(req.jobId, req.jobDescription);

    const analysis = await matchRepository.create({
      userId: req.userId,
      resumeId: req.resumeId,
      track: req.track,
      jobId: resolved.jobId,
      jobDescription: resolved.jobDescription,
    });

    await enqueueMatchAnalysis({
      analysisId: analysis.id,
      userId: req.userId,
      track: req.track,
    });

    return matchRepository.setQueued(analysis.id, analysis.id);
  },

  /**
   * Executed by the queue worker. Loads inputs from DB, calls AI service, persists result.
   * Idempotent on retry: a COMPLETED record short-circuits.
   */
  async processAnalysis(analysisId: string): Promise<MatchAnalysis> {
    const analysis = await matchRepository.findById(analysisId);
    if (!analysis) throw new NotFoundError('MatchAnalysis');
    if (analysis.status === 'COMPLETED') return analysis;

    const resume = await prisma.resume.findUnique({ where: { id: analysis.resumeId } });
    if (!resume) {
      return matchRepository.setFailed(analysisId, 'Resume no longer exists');
    }
    const user = await prisma.user.findUnique({ where: { id: analysis.userId } });
    const userSkills = [
      ...(user?.skills ?? []),
      ...(resume.parsedSkills ?? []),
    ];

    let jobDescription = analysis.jobDescription ?? '';
    let jobSkillsHint: string[] = [];
    if (analysis.jobId) {
      const job = await prisma.job.findUnique({ where: { id: analysis.jobId } });
      if (job?.description) jobDescription = job.description;
      jobSkillsHint = job?.skills ?? [];
    }
    if (!jobDescription) {
      return matchRepository.setFailed(analysisId, 'Missing job description');
    }

    await matchRepository.setRunning(analysisId);

    try {
      const outcome = await aiService.analyzeMatch(
        {
          track: analysis.track as Track,
          userSkills,
          resumeContent: resume.content,
          projectExperience: user?.bio ?? undefined,
          jobDescription,
        },
        { userId: analysis.userId, jobSkillsHint },
      );

      return matchRepository.setCompleted(analysisId, {
        compatibility: outcome.result.compatibility,
        readiness: outcome.result.readiness,
        strengths: outcome.result.strengths,
        missingSkills: outcome.result.missingSkills,
        suggestions: outcome.result.suggestions,
        breakdown: outcome.result.breakdown,
        rawResult: outcome.result as unknown as object,
        model: outcome.model,
        promptHash: outcome.promptHash,
        cacheHit: outcome.cacheHit,
        tokensIn: outcome.tokensIn,
        tokensOut: outcome.tokensOut,
        costUsd: outcome.costUsd,
        durationMs: outcome.durationMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message, analysisId }, 'match analysis failed');
      await matchRepository.setFailed(analysisId, message);
      throw err;
    }
  },
};
