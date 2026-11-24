import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError, NotFoundError } from '../../shared/errors';

const prisma = vi.hoisted(() => ({
  resume: { findFirst: vi.fn(), findUnique: vi.fn() },
  job: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const repo = vi.hoisted(() => ({
  create: vi.fn(),
  setQueued: vi.fn(),
  findReusable: vi.fn(),
}));
const queue = vi.hoisted(() => ({ enqueueMatchAnalysis: vi.fn() }));

vi.mock('@jobpilot/db', () => ({ prisma }));
vi.mock('../../config/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../queue/queues', () => queue);
vi.mock('./ai.service', () => ({ aiService: { analyzeMatch: vi.fn() } }));
vi.mock('./match.repository', () => ({ matchRepository: repo }));

import { matchService } from './match.service';

const JD = 'We are hiring a backend intern to build Node.js APIs with PostgreSQL and Redis queues.';
const RESUME_UPDATED = new Date('2026-11-01T00:00:00Z');

const ownedResume = {
  id: 'resume_1',
  userId: 'user_1',
  content: 'Built REST APIs in Node.js and PostgreSQL during a summer internship.',
  updatedAt: RESUME_UPDATED,
};

const request = { userId: 'user_1', resumeId: 'resume_1', track: 'BACKEND' as const, jobId: 'job_1' };

describe('matchService.createAndEnqueue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.resume.findFirst.mockResolvedValue(ownedResume);
    prisma.job.findUnique.mockResolvedValue({ id: 'job_1', description: JD });
    repo.findReusable.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 'match_new' });
    repo.setQueued.mockResolvedValue({ id: 'match_new', status: 'QUEUED' });
  });

  it('rejects a resume the user does not own', async () => {
    prisma.resume.findFirst.mockResolvedValue(null);
    await expect(matchService.createAndEnqueue({ ...request, userId: 'intruder' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(prisma.resume.findFirst).toHaveBeenCalledWith({ where: { id: 'resume_1', userId: 'intruder' } });
    expect(repo.create).not.toHaveBeenCalled();
    expect(queue.enqueueMatchAnalysis).not.toHaveBeenCalled();
  });

  it('rejects a resume with no extracted text', async () => {
    prisma.resume.findFirst.mockResolvedValue({ ...ownedResume, content: '   ' });
    await expect(matchService.createAndEnqueue(request)).rejects.toBeInstanceOf(BadRequestError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('resolves the job description from jobId and queues new work', async () => {
    const result = await matchService.createAndEnqueue(request);
    expect(repo.create).toHaveBeenCalledWith({
      userId: 'user_1',
      resumeId: 'resume_1',
      track: 'BACKEND',
      jobId: 'job_1',
      jobDescription: JD,
    });
    expect(queue.enqueueMatchAnalysis).toHaveBeenCalledWith({
      analysisId: 'match_new',
      userId: 'user_1',
      track: 'BACKEND',
    });
    expect(result).toEqual({ id: 'match_new', status: 'QUEUED' });
  });

  it('looks for reuse only among results computed from the current inputs', async () => {
    await matchService.createAndEnqueue(request);
    expect(repo.findReusable).toHaveBeenCalledWith({
      userId: 'user_1',
      resumeId: 'resume_1',
      jobId: 'job_1',
      track: 'BACKEND',
      jobDescription: JD,
      notBefore: RESUME_UPDATED,
    });
  });

  it('returns an existing completed analysis instead of creating duplicate work', async () => {
    const existing = { id: 'match_old', status: 'COMPLETED' };
    repo.findReusable.mockResolvedValue(existing);
    const result = await matchService.createAndEnqueue(request);
    expect(result).toBe(existing);
    expect(repo.create).not.toHaveBeenCalled();
    expect(queue.enqueueMatchAnalysis).not.toHaveBeenCalled();
  });
});
