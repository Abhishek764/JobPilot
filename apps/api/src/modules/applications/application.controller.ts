import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';
import { param } from '../../shared/params';

import { applicationService } from './application.service';

const getClerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

export const applicationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.list(getClerkId(req), req.query as never);
    res.json({ success: true, data: result });
  }),

  board: asyncHandler(async (req: Request, res: Response) => {
    const board = await applicationService.board(getClerkId(req), req.query as never);
    res.json({ success: true, data: board });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.get(getClerkId(req), param(req, 'id'));
    res.json({ success: true, data: app });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.create(getClerkId(req), req.body);
    res.status(201).json({ success: true, data: app });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.update(getClerkId(req), param(req, 'id'), req.body);
    res.json({ success: true, data: app });
  }),

  move: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.move(getClerkId(req), param(req, 'id'), req.body);
    res.json({ success: true, data: app });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const app = await applicationService.updateStatus(getClerkId(req), param(req, 'id'), req.body);
    res.json({ success: true, data: app });
  }),

  events: asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.listEvents(getClerkId(req), param(req, 'id'), req.query as never);
    res.json({ success: true, data: result });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await applicationService.delete(getClerkId(req), param(req, 'id'));
    res.status(204).send();
  }),
};
