import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';

import { applicationService } from './application.service';

const getClerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

export const applicationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.list(getClerkId(req), req.query as never);
    res.json({ success: true, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.get(getClerkId(req), req.params.id);
    res.json({ success: true, data: app });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.create(getClerkId(req), req.body);
    res.status(201).json({ success: true, data: app });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.update(getClerkId(req), req.params.id, req.body);
    res.json({ success: true, data: app });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await applicationService.delete(getClerkId(req), req.params.id);
    res.status(204).send();
  }),
};
