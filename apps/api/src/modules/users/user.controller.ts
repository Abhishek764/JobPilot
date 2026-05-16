import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';

import { userService } from './user.service';

const getClerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

const toPublic = <T extends { clerkId: string }>(user: T): Omit<T, 'clerkId'> => {
  const { clerkId: _clerkId, ...rest } = user;
  return rest;
};

export const userController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getByClerkId(getClerkId(req));
    res.json({ success: true, data: toPublic(user) });
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateProfile(getClerkId(req), req.body);
    res.json({ success: true, data: toPublic(user) });
  }),

  onboard: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.completeOnboarding(getClerkId(req), req.body);
    res.status(201).json({ success: true, data: toPublic(user) });
  }),
};
