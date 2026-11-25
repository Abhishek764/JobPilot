import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../shared/errors';

const prisma = vi.hoisted(() => ({
  resume: { findFirst: vi.fn(), findUnique: vi.fn() },
  job: { findUnique: vi.fn() },
  resumeVersion: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
}));
const queue = vi.hoisted(() => ({ enqueueResumeVersion: vi.fn() }));
const ai = vi.hoisted(() => ({ tailorResume: vi.fn() }));
const users = vi.hoisted(() => ({ getByClerkId: vi.fn() }));
const quota = vi.hoisted(() => ({ assertAiQuota: vi.fn() }));

vi.mock('@jobpilot/db', () => ({ prisma }));
vi.mock('../../shared/ai-quota', () => quota);
vi.mock('../../config/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('../queue/queues', () => queue);
vi.mock('../ai/ai.service', () => ({ aiService: ai }));
vi.mock('../users/user.service', () => ({ userService: users }));

import { versionService } from './version.service';

const resume = { id: 'resume_1', userId: 'user_1', content: 'Python, SQL, two data internships.' };
const JD = 'Data analyst intern: SQL, Python, dashboards, stakeholder communication.';

describe('versionService.create', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.getByClerkId.mockResolvedValue({ id: 'user_1' });
    prisma.resume.findFirst.mockImplementation(
      async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === 'resume_1' && where.userId === 'user_1' ? resume : null,
    );
    prisma.job.findUnique.mockResolvedValue({
      id: 'job_1',
      title: 'Data Analyst Intern',
      company: 'Acme',
      description: JD,
    });
    prisma.resumeVersion.create.mockResolvedValue({ id: 'v_1', status: 'QUEUED' });
    prisma.resumeVersion.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'v_1',
      ...data,
    }));
  });

  it('rejects another user’s resume without queuing work', async () => {
    users.getByClerkId.mockResolvedValue({ id: 'intruder' });
    await expect(versionService.create('c', 'resume_1', { jobId: 'job_1' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(prisma.resumeVersion.create).not.toHaveBeenCalled();
  });

  it('labels the version after the job and queues it', async () => {
    await versionService.create('c', 'resume_1', { jobId: 'job_1' });
    expect(quota.assertAiQuota).toHaveBeenCalledWith('resumeVersion', 'user_1');
    expect(prisma.resumeVersion.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        resumeId: 'resume_1',
        analysisId: null,
        jobId: 'job_1',
        jobDescription: JD,
        label: 'Data Analyst Intern — Acme',
        status: 'QUEUED',
      },
    });
    expect(queue.enqueueResumeVersion).toHaveBeenCalledWith({ versionId: 'v_1' });
  });

  it('404s for an unknown job', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(
      versionService.create('c', 'resume_1', { jobId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('marks the version FAILED when it cannot be queued', async () => {
    queue.enqueueResumeVersion.mockRejectedValue(new Error('redis down'));
    await expect(versionService.create('c', 'resume_1', { jobId: 'job_1' })).rejects.toThrow();
    expect(prisma.resumeVersion.update).toHaveBeenLastCalledWith({
      where: { id: 'v_1' },
      data: { status: 'FAILED', error: expect.stringContaining('redis down') },
    });
  });
});

describe('versionService.process', () => {
  const queued = {
    id: 'v_1',
    resumeId: 'resume_1',
    userId: 'user_1',
    jobDescription: JD,
    status: 'QUEUED',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.resumeVersion.findUnique.mockResolvedValue(queued);
    prisma.resume.findUnique.mockResolvedValue(resume);
    prisma.resumeVersion.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'v_1',
      ...data,
    }));
  });

  it('stores the tailored markdown on success', async () => {
    ai.tailorResume.mockResolvedValue({
      markdown: '# Jane\n\n## Skills\n- SQL',
      model: 'gemini-test',
      tokensIn: 1,
      tokensOut: 2,
      costUsd: 0,
    });
    await versionService.process('v_1');
    expect(ai.tailorResume).toHaveBeenCalledWith({
      resumeContent: resume.content,
      jobDescription: JD,
      userId: 'user_1',
    });
    expect(prisma.resumeVersion.update).toHaveBeenLastCalledWith({
      where: { id: 'v_1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        markdown: '# Jane\n\n## Skills\n- SQL',
      }),
    });
  });

  it('stays pending between retries and fails on the final attempt', async () => {
    ai.tailorResume.mockRejectedValue(new Error('quota'));
    await expect(versionService.process('v_1', { finalAttempt: false })).rejects.toThrow();
    expect(prisma.resumeVersion.update).toHaveBeenLastCalledWith({
      where: { id: 'v_1' },
      data: { status: 'QUEUED', error: 'quota' },
    });
    await expect(versionService.process('v_1', { finalAttempt: true })).rejects.toThrow();
    expect(prisma.resumeVersion.update).toHaveBeenLastCalledWith({
      where: { id: 'v_1' },
      data: { status: 'FAILED', error: 'quota' },
    });
  });
});
