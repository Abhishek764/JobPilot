import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../shared/errors';

const prisma = vi.hoisted(() => ({
  resume: { findFirst: vi.fn(), findUnique: vi.fn() },
  job: { findUnique: vi.fn() },
}));
const ai = vi.hoisted(() => ({ matchResumeToJob: vi.fn() }));
const users = vi.hoisted(() => ({ getByClerkId: vi.fn() }));

vi.mock('@jobpilot/db', () => ({ prisma }));
vi.mock('./ai.service', () => ({ aiService: ai }));
vi.mock('../users/user.service', () => ({ userService: users }));

import { aiController } from './ai.controller';

const run = async (body: unknown) => {
  const req = { body, clerkUserId: 'clerk_b' } as unknown as Request;
  const json = vi.fn();
  const res = { json, status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn();
  aiController.analyzeResume(req, res, next);
  await new Promise((r) => setImmediate(r));
  return { json, next };
};

describe('aiController.analyzeResume', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.getByClerkId.mockResolvedValue({ id: 'user_b' });
    prisma.resume.findFirst.mockResolvedValue(null);
    prisma.resume.findUnique.mockResolvedValue({
      id: 'resume_a',
      userId: 'user_a',
      content: 'secret',
    });
  });

  it('does not analyze a resume owned by another user', async () => {
    const { json, next } = await run({
      resumeId: 'resume_a',
      jobDescription: 'x'.repeat(60),
    });
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(prisma.resume.findFirst).toHaveBeenCalledWith({
      where: { id: 'resume_a', userId: 'user_b' },
    });
    expect(ai.matchResumeToJob).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
