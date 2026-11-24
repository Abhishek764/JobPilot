import { prisma } from '@jobpilot/db';
import type { Request, Response } from 'express';

import { BadRequestError, NotFoundError } from '../../shared/errors';
import { asyncHandler } from '../../shared/async-handler';
import { userService } from '../users/user.service';

import { aiService } from './ai.service';

export const aiController = {
  analyzeResume: asyncHandler(async (req: Request, res: Response) => {
    const { resumeId, jobId, jobDescription } = req.body as {
      resumeId: string;
      jobId?: string;
      jobDescription?: string;
    };

    const clerkUserId = (req as Request & { clerkUserId: string }).clerkUserId;
    const user = await userService.getByClerkId(clerkUserId);
    // Scope by owner: another user's resume is indistinguishable from a missing one.
    const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
    if (!resume) throw new NotFoundError('Resume');

    let jd = jobDescription;
    if (!jd && jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job?.description) throw new NotFoundError('Job description');
      jd = job.description;
    }
    if (!jd) throw new BadRequestError('jobDescription or jobId required');

    const match = await aiService.matchResumeToJob(resume.content, jd);
    res.json({ success: true, data: { ...match, jobId: jobId ?? null } });
  }),
};
