import { prisma } from '@jobpilot/db';
import type { MatchAnalysis, MatchStatus, MatchTrack, Prisma } from '@jobpilot/db';

export interface CreateMatchInput {
  userId: string;
  resumeId: string;
  track: MatchTrack;
  jobId?: string | null;
  jobDescription?: string | null;
}

export const matchRepository = {
  create(data: CreateMatchInput): Promise<MatchAnalysis> {
    return prisma.matchAnalysis.create({
      data: {
        userId: data.userId,
        resumeId: data.resumeId,
        track: data.track,
        jobId: data.jobId ?? null,
        jobDescription: data.jobDescription ?? null,
      },
    });
  },

  findById(id: string): Promise<MatchAnalysis | null> {
    return prisma.matchAnalysis.findUnique({ where: { id } });
  },

  findByIdForUser(id: string, userId: string): Promise<MatchAnalysis | null> {
    return prisma.matchAnalysis.findFirst({ where: { id, userId } });
  },

  listForUser(
    userId: string,
    opts: { page: number; pageSize: number; track?: MatchTrack; status?: MatchStatus },
  ): Promise<{ rows: MatchAnalysis[]; total: number }> {
    const where: Prisma.MatchAnalysisWhereInput = {
      userId,
      ...(opts.track ? { track: opts.track } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    };
    return Promise.all([
      prisma.matchAnalysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      prisma.matchAnalysis.count({ where }),
    ]).then(([rows, total]) => ({ rows, total }));
  },

  setQueued(id: string, queueJobId: string): Promise<MatchAnalysis> {
    return prisma.matchAnalysis.update({
      where: { id },
      data: { status: 'QUEUED', queueJobId },
    });
  },

  setRunning(id: string): Promise<MatchAnalysis> {
    return prisma.matchAnalysis.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date(), error: null },
    });
  },

  setCompleted(
    id: string,
    data: {
      compatibility: number;
      readiness: number;
      strengths: string[];
      missingSkills: string[];
      suggestions: string[];
      breakdown: object;
      rawResult: object;
      model: string;
      promptHash: string;
      cacheHit: boolean;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
      durationMs: number;
    },
  ): Promise<MatchAnalysis> {
    return prisma.matchAnalysis.update({
      where: { id },
      data: {
        ...data,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  },

  setFailed(id: string, error: string): Promise<MatchAnalysis> {
    return prisma.matchAnalysis.update({
      where: { id },
      data: { status: 'FAILED', error, completedAt: new Date() },
    });
  },
};
