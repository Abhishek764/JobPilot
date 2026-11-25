import { Router, type Request, type Response } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../shared/async-handler';

import { dashboardService } from './dashboard.service';

export const dashboardRouter: Router = Router();

dashboardRouter.use(requireAuth, attachUserId);

dashboardRouter.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const clerkUserId = (req as Request & { clerkUserId: string }).clerkUserId;
    const data = await dashboardService.summary(clerkUserId);
    res.json({ success: true, data });
  }),
);
