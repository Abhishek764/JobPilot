import { prisma } from '@jobpilot/db';
import type {
  DashboardAttentionItem,
  DashboardRecommendedJob,
  DashboardSummary,
} from '@jobpilot/types';

export const STRONG_MATCH_THRESHOLD = 80;
const CLOSED_STATUSES = ['REJECTED', 'WITHDRAWN', 'GHOSTED'] as const;
const REMINDER_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const RECOMMENDED_LIMIT = 5;
const ATTENTION_LIMIT = 5;

const matchVerb: Record<string, string> = {
  QUEUED: 'is queued',
  RUNNING: 'is running',
  FAILED: 'failed — retry',
};

const resumeVerb: Record<string, string> = {
  UPLOADED: 'is waiting to parse',
  PARSING: 'is parsing',
  FAILED: 'failed to parse',
};

export const dashboardRepository = {
  /** Aggregate a student's Command Center from persisted rows only. */
  async summary(userId: string, now: Date = new Date()): Promise<DashboardSummary> {
    const horizon = new Date(now.getTime() + REMINDER_HORIZON_MS);
    const pendingReminderWhere = {
      application: { userId },
      status: 'PENDING' as const,
      dueAt: { lte: horizon },
    };

    const [
      strongMatches,
      activeApplications,
      latestAnalysis,
      pendingActions,
      recentMatches,
      openMatches,
      reminders,
      resumes,
    ] = await Promise.all([
      prisma.matchAnalysis.count({
        where: { userId, status: 'COMPLETED', compatibility: { gte: STRONG_MATCH_THRESHOLD } },
      }),
      prisma.application.count({
        where: { userId, status: { notIn: [...CLOSED_STATUSES] } },
      }),
      prisma.resumeAnalysis.findFirst({
        where: { userId, status: 'COMPLETED', overallScore: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { overallScore: true },
      }),
      prisma.reminder.count({ where: pendingReminderWhere }),
      prisma.matchAnalysis.findMany({
        where: { userId, status: 'COMPLETED', job: { isActive: true } },
        orderBy: { completedAt: 'desc' },
        take: RECOMMENDED_LIMIT * 4,
        select: {
          id: true,
          compatibility: true,
          job: {
            select: { id: true, title: true, company: true, location: true, sourcePlatform: true },
          },
        },
      }),
      prisma.matchAnalysis.findMany({
        where: { userId, status: { in: ['QUEUED', 'RUNNING', 'FAILED'] } },
        orderBy: { createdAt: 'desc' },
        take: ATTENTION_LIMIT,
        select: { id: true, status: true, resumeId: true, job: { select: { id: true, title: true } } },
      }),
      prisma.reminder.findMany({
        where: pendingReminderWhere,
        orderBy: { dueAt: 'asc' },
        take: ATTENTION_LIMIT,
        select: { id: true, title: true, applicationId: true, application: { select: { company: true } } },
      }),
      prisma.resume.findMany({
        where: { userId, fileStatus: { in: ['UPLOADED', 'PARSING', 'FAILED'] } },
        orderBy: { updatedAt: 'desc' },
        take: ATTENTION_LIMIT,
        select: { id: true, title: true, fileStatus: true },
      }),
    ]);

    // Newest completed match per job wins; older re-runs of the same job are skipped.
    const seen = new Set<string>();
    const recommendedJobs: DashboardRecommendedJob[] = [];
    for (const m of recentMatches) {
      if (!m.job || seen.has(m.job.id)) continue;
      seen.add(m.job.id);
      recommendedJobs.push({
        id: m.job.id,
        title: m.job.title,
        company: m.job.company,
        location: m.job.location,
        sourcePlatform: m.job.sourcePlatform,
        compatibility: m.compatibility,
        matchId: m.id,
      });
      if (recommendedJobs.length === RECOMMENDED_LIMIT) break;
    }

    const attentionItems: DashboardAttentionItem[] = [
      ...reminders.map((r) => ({
        kind: 'REMINDER' as const,
        id: r.id,
        label: `${r.title} — ${r.application.company}`,
        href: `/applications?open=${r.applicationId}`,
      })),
      ...resumes.map((r) => ({
        kind: 'PARSING' as const,
        id: r.id,
        label: `${r.title} ${resumeVerb[r.fileStatus] ?? 'needs attention'}`,
        href: `/resume/${r.id}`,
      })),
      ...openMatches.map((m) => ({
        kind: 'MATCH' as const,
        id: m.id,
        label: `Match for ${m.job?.title ?? 'pasted job'} ${matchVerb[m.status] ?? 'needs attention'}`,
        href: m.job ? `/jobs/${m.job.id}` : `/resume/${m.resumeId}`,
      })),
    ];

    return {
      metrics: {
        strongMatches,
        activeApplications,
        resumeHealth: latestAnalysis?.overallScore ?? null,
        pendingActions,
      },
      recommendedJobs,
      attentionItems,
    };
  },
};
