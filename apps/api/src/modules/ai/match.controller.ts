import type { Request, Response } from 'express';
import type {
  CreateMatchAnalysisInput,
  ListMatchAnalysesQuery,
} from '@jobpilot/types/schemas';

import { asyncHandler } from '../../shared/async-handler';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/errors';
import { userService } from '../users/user.service';

import { matchRepository } from './match.repository';
import { matchService } from './match.service';

const getClerkId = (req: Request): string => {
  const id = (req as Request & { clerkUserId?: string }).clerkUserId;
  if (!id) throw new UnauthorizedError();
  return id;
};

const resolveUserId = async (req: Request): Promise<string> => {
  if (req.user?.id) return req.user.id;
  const user = await userService.getByClerkId(getClerkId(req));
  return user.id;
};

export const matchController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    const body = req.body as CreateMatchAnalysisInput;
    const analysis = await matchService.createAndEnqueue({
      userId,
      resumeId: body.resumeId,
      track: body.track,
      jobId: body.jobId,
      jobDescription: body.jobDescription,
    });
    res.status(202).json({
      success: true,
      data: {
        id: analysis.id,
        status: analysis.status,
        track: analysis.track,
        createdAt: analysis.createdAt,
      },
    });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    const analysis = await matchRepository.findById(req.params.id);
    if (!analysis) throw new NotFoundError('MatchAnalysis');
    if (analysis.userId !== userId) throw new ForbiddenError();
    res.json({ success: true, data: analysis });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    const q = req.query as unknown as ListMatchAnalysesQuery;
    const { rows, total } = await matchRepository.listForUser(userId, {
      page: q.page,
      pageSize: q.pageSize,
      track: q.track,
      status: q.status,
    });
    res.json({
      success: true,
      data: rows,
      pagination: { page: q.page, pageSize: q.pageSize, total },
    });
  }),
};
