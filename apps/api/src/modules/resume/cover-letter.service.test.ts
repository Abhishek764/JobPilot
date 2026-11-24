import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError, NotFoundError } from '../../shared/errors';

const prisma = vi.hoisted(() => ({
  resume: { findFirst: vi.fn(), findUnique: vi.fn() },
  job: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  coverLetter: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));
const queue = vi.hoisted(() => ({ enqueueCoverLetter: vi.fn() }));
const ai = vi.hoisted(() => ({ generateCoverLetter: vi.fn(), recordUsage: vi.fn() }));
const users = vi.hoisted(() => ({ getByClerkId: vi.fn() }));

vi.mock('@jobpilot/db', () => ({ prisma }));
vi.mock('../../config/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('../queue/queues', () => queue);
vi.mock('../ai/ai.service', () => ({ aiService: ai }));
vi.mock('../users/user.service', () => ({ userService: users }));

import { coverLetterService } from './cover-letter.service';

const JD = 'Frontend intern to build accessible React interfaces with TypeScript and testing.';
const resume = {
  id: 'resume_1',
  userId: 'user_1',
  content: 'React and TypeScript projects; accessibility work.',
};

describe('coverLetterService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.getByClerkId.mockResolvedValue({ id: 'user_1' });
    prisma.resume.findFirst.mockImplementation(
      async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === 'resume_1' && where.userId === 'user_1' ? resume : null,
    );
    prisma.job.findUnique.mockResolvedValue({
      id: 'job_1',
      description: JD,
      title: 'Frontend Intern',
      company: 'Acme',
    });
    prisma.coverLetter.create.mockResolvedValue({ id: 'cl_1', status: 'QUEUED' });
    prisma.coverLetter.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'cl_1',
      ...data,
    }));
  });

  describe('create', () => {
    it('rejects a resume owned by someone else without queuing work', async () => {
      users.getByClerkId.mockResolvedValue({ id: 'intruder' });
      await expect(
        coverLetterService.create('clerk_x', 'resume_1', { jobId: 'job_1', tone: 'PROFESSIONAL' }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(prisma.coverLetter.create).not.toHaveBeenCalled();
      expect(queue.enqueueCoverLetter).not.toHaveBeenCalled();
    });

    it('rejects a resume that has no extracted text', async () => {
      prisma.resume.findFirst.mockResolvedValue({ ...resume, content: '' });
      await expect(
        coverLetterService.create('clerk_1', 'resume_1', { jobId: 'job_1', tone: 'PROFESSIONAL' }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it('resolves the job description and enqueues instead of generating inline', async () => {
      await coverLetterService.create('clerk_1', 'resume_1', { jobId: 'job_1', tone: 'CONCISE' });
      expect(prisma.coverLetter.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_1',
          resumeId: 'resume_1',
          jobId: 'job_1',
          jobDescription: JD,
          tone: 'CONCISE',
          status: 'QUEUED',
        },
      });
      expect(queue.enqueueCoverLetter).toHaveBeenCalledWith({ coverLetterId: 'cl_1' });
      expect(ai.generateCoverLetter).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('is scoped to the owner', async () => {
      prisma.coverLetter.findFirst.mockResolvedValue(null);
      await expect(coverLetterService.get('clerk_1', 'cl_other')).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(prisma.coverLetter.findFirst).toHaveBeenCalledWith({
        where: { id: 'cl_other', userId: 'user_1' },
      });
    });
  });

  describe('process (worker)', () => {
    const queued = {
      id: 'cl_1',
      userId: 'user_1',
      resumeId: 'resume_1',
      jobId: 'job_1',
      jobDescription: JD,
      tone: 'PROFESSIONAL',
      status: 'QUEUED',
    };

    it('short-circuits an already completed letter', async () => {
      prisma.coverLetter.findUnique.mockResolvedValue({ ...queued, status: 'COMPLETED' });
      await coverLetterService.process('cl_1');
      expect(ai.generateCoverLetter).not.toHaveBeenCalled();
    });

    it('stores generated content and telemetry on success', async () => {
      prisma.coverLetter.findUnique.mockResolvedValue(queued);
      prisma.resume.findUnique.mockResolvedValue(resume);
      prisma.user.findUnique.mockResolvedValue({ name: 'Sam' });
      ai.generateCoverLetter.mockResolvedValue({
        content: 'Dear Acme team, …',
        model: 'gemini-test',
        tokensIn: 100,
        tokensOut: 50,
        costUsd: 0.001,
      });
      await coverLetterService.process('cl_1');
      expect(ai.generateCoverLetter).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeContent: resume.content,
          jobDescription: JD,
          tone: 'PROFESSIONAL',
        }),
      );
      expect(prisma.coverLetter.update).toHaveBeenLastCalledWith({
        where: { id: 'cl_1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          content: 'Dear Acme team, …',
          model: 'gemini-test',
        }),
      });
    });

    it('marks the letter FAILED and rethrows so the queue can retry', async () => {
      prisma.coverLetter.findUnique.mockResolvedValue(queued);
      prisma.resume.findUnique.mockResolvedValue(resume);
      prisma.user.findUnique.mockResolvedValue(null);
      ai.generateCoverLetter.mockRejectedValue(new Error('quota'));
      await expect(coverLetterService.process('cl_1')).rejects.toThrow('quota');
      expect(prisma.coverLetter.update).toHaveBeenLastCalledWith({
        where: { id: 'cl_1' },
        data: { status: 'FAILED', error: 'quota' },
      });
    });
  });
});
