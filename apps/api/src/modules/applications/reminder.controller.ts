import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';

import { reminderService } from './reminder.service';

const getClerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

export const reminderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const reminders = await reminderService.list(getClerkId(req), req.params.id, req.query as never);
    res.json({ success: true, data: reminders });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.create(getClerkId(req), req.params.id, req.body);
    res.status(201).json({ success: true, data: reminder });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.update(
      getClerkId(req),
      req.params.id,
      req.params.reminderId,
      req.body,
    );
    res.json({ success: true, data: reminder });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await reminderService.delete(getClerkId(req), req.params.id, req.params.reminderId);
    res.status(204).send();
  }),
};
