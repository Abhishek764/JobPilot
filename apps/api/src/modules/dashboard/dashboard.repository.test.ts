import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  matchAnalysis: { count: vi.fn(), findMany: vi.fn() },
  application: { count: vi.fn() },
  resumeAnalysis: { findFirst: vi.fn() },
  reminder: { count: vi.fn(), findMany: vi.fn() },
  resume: { findMany: vi.fn() },
}));

vi.mock('@jobpilot/db', () => ({ prisma }));

import { dashboardRepository } from './dashboard.repository';

const USER = 'user_1';
const NOW = new Date('2026-11-24T12:00:00Z');

const emptyAccount = () => {
  prisma.matchAnalysis.count.mockResolvedValue(0);
  prisma.matchAnalysis.findMany.mockResolvedValue([]);
  prisma.application.count.mockResolvedValue(0);
  prisma.resumeAnalysis.findFirst.mockResolvedValue(null);
  prisma.reminder.count.mockResolvedValue(0);
  prisma.reminder.findMany.mockResolvedValue([]);
  prisma.resume.findMany.mockResolvedValue([]);
};

/** Every `where` passed to a Prisma call must constrain by the caller's user. */
const scopedToUser = (where: Record<string, unknown>): boolean =>
  where.userId === USER ||
  (typeof where.application === 'object' &&
    (where.application as Record<string, unknown>).userId === USER);

describe('dashboardRepository.summary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    emptyAccount();
  });

  it('returns zero metrics and empty lists for an empty account', async () => {
    const summary = await dashboardRepository.summary(USER, NOW);
    expect(summary).toEqual({
      metrics: { strongMatches: 0, activeApplications: 0, resumeHealth: null, pendingActions: 0 },
      recommendedJobs: [],
      attentionItems: [],
    });
  });

  it('scopes every query by the authenticated userId', async () => {
    await dashboardRepository.summary(USER, NOW);
    const calls = [
      ...prisma.matchAnalysis.count.mock.calls,
      ...prisma.matchAnalysis.findMany.mock.calls,
      ...prisma.application.count.mock.calls,
      ...prisma.resumeAnalysis.findFirst.mock.calls,
      ...prisma.reminder.count.mock.calls,
      ...prisma.reminder.findMany.mock.calls,
      ...prisma.resume.findMany.mock.calls,
    ];
    expect(calls.length).toBeGreaterThanOrEqual(7);
    for (const [args] of calls) expect(scopedToUser(args.where)).toBe(true);
  });

  it('counts strong matches at compatibility >= 80 and excludes closed applications', async () => {
    await dashboardRepository.summary(USER, NOW);
    expect(prisma.matchAnalysis.count).toHaveBeenCalledWith({
      where: { userId: USER, status: 'COMPLETED', compatibility: { gte: 80 } },
    });
    expect(prisma.application.count).toHaveBeenCalledWith({
      where: { userId: USER, status: { notIn: ['REJECTED', 'WITHDRAWN', 'GHOSTED'] } },
    });
  });

  it('maps real rows into metrics, recommended jobs and attention items', async () => {
    prisma.matchAnalysis.count.mockResolvedValue(2);
    prisma.application.count.mockResolvedValue(4);
    prisma.resumeAnalysis.findFirst.mockResolvedValue({ overallScore: 72 });
    prisma.reminder.count.mockResolvedValue(1);
    prisma.matchAnalysis.findMany
      .mockResolvedValueOnce([
        {
          id: 'm1',
          compatibility: 91,
          job: { id: 'j1', title: 'SWE Intern', company: 'Acme', location: 'Remote', sourcePlatform: 'LINKEDIN' },
        },
        {
          id: 'm0',
          compatibility: 60,
          job: { id: 'j1', title: 'SWE Intern', company: 'Acme', location: 'Remote', sourcePlatform: 'LINKEDIN' },
        },
      ])
      .mockResolvedValueOnce([{ id: 'm2', status: 'RUNNING', resumeId: 'cv1', job: { id: 'j2', title: 'Data Intern' } }]);
    prisma.reminder.findMany.mockResolvedValue([
      { id: 'r1', title: 'Follow up', applicationId: 'a1', application: { company: 'Acme' } },
    ]);
    prisma.resume.findMany.mockResolvedValue([{ id: 'cv1', title: 'Main CV', fileStatus: 'PARSING' }]);

    const summary = await dashboardRepository.summary(USER, NOW);

    expect(summary.metrics).toEqual({
      strongMatches: 2,
      activeApplications: 4,
      resumeHealth: 72,
      pendingActions: 1,
    });
    expect(summary.recommendedJobs).toEqual([
      {
        id: 'j1',
        title: 'SWE Intern',
        company: 'Acme',
        location: 'Remote',
        sourcePlatform: 'LINKEDIN',
        compatibility: 91,
        matchId: 'm1',
      },
    ]);
    expect(summary.attentionItems).toEqual([
      { kind: 'REMINDER', id: 'r1', label: 'Follow up — Acme', href: '/applications?open=a1' },
      { kind: 'PARSING', id: 'cv1', label: 'Main CV is parsing', href: '/resume/cv1' },
      { kind: 'MATCH', id: 'm2', label: 'Match for Data Intern is running', href: '/jobs/j2' },
    ]);
  });
});
