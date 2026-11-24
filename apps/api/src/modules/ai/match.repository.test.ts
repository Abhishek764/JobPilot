import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ matchAnalysis: { findMany: vi.fn(), count: vi.fn() } }));
vi.mock('@jobpilot/db', () => ({ prisma }));

import { matchRepository } from './match.repository';

describe('matchRepository.listForUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.matchAnalysis.findMany.mockResolvedValue([]);
    prisma.matchAnalysis.count.mockResolvedValue(0);
  });

  it('narrows to one job when jobId is given, always scoped by user', async () => {
    await matchRepository.listForUser('user_1', { page: 1, pageSize: 5, jobId: 'job_1' });
    expect(prisma.matchAnalysis.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', jobId: 'job_1' },
    });
  });

  it('narrows to one resume when resumeId is given', async () => {
    await matchRepository.listForUser('user_1', { page: 1, pageSize: 5, resumeId: 'resume_1' });
    expect(prisma.matchAnalysis.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', resumeId: 'resume_1' },
    });
  });
});
