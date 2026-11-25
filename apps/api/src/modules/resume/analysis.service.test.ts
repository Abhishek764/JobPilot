import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError, NotFoundError } from '../../shared/errors';

const prisma = vi.hoisted(() => ({
  resume: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  job: { findUnique: vi.fn() },
  resumeAnalysis: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
}));
const queue = vi.hoisted(() => ({ enqueueResumeAnalysis: vi.fn() }));
const ai = vi.hoisted(() => ({ analyzeResume: vi.fn() }));
const users = vi.hoisted(() => ({ getByClerkId: vi.fn() }));

vi.mock('@jobpilot/db', () => ({ prisma }));
vi.mock('../../config/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('../queue/queues', () => queue);
vi.mock('../ai/ai.service', () => ({ aiService: ai }));
vi.mock('../users/user.service', () => ({ userService: users }));

import { analysisService } from './analysis.service';

const resume = { id: 'resume_1', userId: 'user_1', content: 'Python, SQL, two data internships.' };
const JD = 'Data analyst intern: SQL, Python, dashboards, stakeholder communication.';

const result = {
  atsScore: 74,
  keywordScore: null,
  overallScore: 71,
  matchedKeywords: [],
  missingKeywords: [],
  strengths: ['Quantified internship impact'],
  weaknesses: ['No summary section'],
  suggestions: [
    { section: 'Summary', issue: 'Missing', recommendation: 'Add two lines', severity: 'medium' },
  ],
  atsIssues: [{ check: 'Standard headings', passed: true, detail: 'OK' }],
  model: 'gemini-test',
  tokensIn: 10,
  tokensOut: 20,
  costUsd: 0,
};

describe('analysisService.create', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.getByClerkId.mockResolvedValue({ id: 'user_1' });
    prisma.resume.findFirst.mockImplementation(
      async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === 'resume_1' && where.userId === 'user_1' ? resume : null,
    );
    prisma.resumeAnalysis.create.mockResolvedValue({ id: 'an_1', status: 'QUEUED' });
    prisma.resumeAnalysis.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'an_1',
      ...data,
    }));
  });

  it('rejects another user’s resume without queuing work', async () => {
    users.getByClerkId.mockResolvedValue({ id: 'intruder' });
    await expect(analysisService.create('c', 'resume_1', {})).rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.resumeAnalysis.create).not.toHaveBeenCalled();
  });

  it('rejects a resume with no extracted text', async () => {
    prisma.resume.findFirst.mockResolvedValue({ ...resume, content: ' ' });
    await expect(analysisService.create('c', 'resume_1', {})).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('queues an ATS-only analysis when no job is given', async () => {
    await analysisService.create('c', 'resume_1', {});
    expect(prisma.resumeAnalysis.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        resumeId: 'resume_1',
        jobId: null,
        jobDescription: null,
        status: 'QUEUED',
      },
    });
    expect(queue.enqueueResumeAnalysis).toHaveBeenCalledWith({ analysisId: 'an_1' });
  });

  it('uses the saved job description when a jobId is given', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'job_1', description: JD });
    await analysisService.create('c', 'resume_1', { jobId: 'job_1' });
    expect(prisma.resumeAnalysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ jobId: 'job_1', jobDescription: JD }),
    });
  });

  it('404s for an unknown job', async () => {
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(
      analysisService.create('c', 'resume_1', { jobId: 'job_missing' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('marks the analysis FAILED when it cannot be queued', async () => {
    queue.enqueueResumeAnalysis.mockRejectedValue(new Error('redis down'));
    await expect(analysisService.create('c', 'resume_1', {})).rejects.toThrow('redis down');
    expect(prisma.resumeAnalysis.update).toHaveBeenLastCalledWith({
      where: { id: 'an_1' },
      data: { status: 'FAILED', error: expect.stringContaining('redis down') },
    });
  });
});

describe('analysisService.process', () => {
  const queued = {
    id: 'an_1',
    resumeId: 'resume_1',
    userId: 'user_1',
    jobDescription: null,
    status: 'QUEUED',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.resumeAnalysis.findUnique.mockResolvedValue(queued);
    prisma.resume.findUnique.mockResolvedValue(resume);
    prisma.resumeAnalysis.update.mockImplementation(async ({ data }: { data: object }) => ({
      id: 'an_1',
      ...data,
    }));
  });

  it('stores scores, evidence and the resume’s ATS score on success', async () => {
    ai.analyzeResume.mockResolvedValue(result);
    await analysisService.process('an_1');
    expect(ai.analyzeResume).toHaveBeenCalledWith({
      resumeContent: resume.content,
      jobDescription: null,
      userId: 'user_1',
    });
    expect(prisma.resumeAnalysis.update).toHaveBeenLastCalledWith({
      where: { id: 'an_1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        atsScore: 74,
        keywordScore: null,
        overallScore: 71,
        strengths: ['Quantified internship impact'],
        model: 'gemini-test',
      }),
    });
    expect(prisma.resume.update).toHaveBeenCalledWith({
      where: { id: 'resume_1' },
      data: { atsScore: 74 },
    });
  });

  it('short-circuits a completed analysis', async () => {
    prisma.resumeAnalysis.findUnique.mockResolvedValue({ ...queued, status: 'COMPLETED' });
    await analysisService.process('an_1');
    expect(ai.analyzeResume).not.toHaveBeenCalled();
  });

  it('stays pending between retries and fails on the final attempt', async () => {
    ai.analyzeResume.mockRejectedValue(new Error('quota'));
    await expect(analysisService.process('an_1', { finalAttempt: false })).rejects.toThrow('quota');
    expect(prisma.resumeAnalysis.update).toHaveBeenLastCalledWith({
      where: { id: 'an_1' },
      data: { status: 'QUEUED', error: 'quota' },
    });
    await expect(analysisService.process('an_1', { finalAttempt: true })).rejects.toThrow('quota');
    expect(prisma.resumeAnalysis.update).toHaveBeenLastCalledWith({
      where: { id: 'an_1' },
      data: { status: 'FAILED', error: 'quota' },
    });
  });
});
