import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';

import { userService } from './user.service';

export const userController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    const { clerkUserId } = req as Request & { clerkUserId: string };
    const user = await userService.getByClerkId(clerkUserId);
    res.json({ success: true, data: user });
  }),
};
