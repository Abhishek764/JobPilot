import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';
import { param } from '../../shared/params';

import { reminderService } from './reminder.service';

const getClerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

export const reminderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const reminders = await reminderService.list(getClerkId(req), param(req, 'id'), req.query as never);
    res.json({ success: true, data: reminders });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.create(getClerkId(req), param(req, 'id'), req.body);
    res.status(201).json({ success: true, data: reminder });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const reminder = await reminderService.update(
      getClerkId(req),
      param(req, 'id'),
      param(req, 'reminderId'),
      req.body,
    );
    res.json({ success: true, data: reminder });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await reminderService.delete(getClerkId(req), param(req, 'id'), param(req, 'reminderId'));
    res.status(204).send();
  }),
};
