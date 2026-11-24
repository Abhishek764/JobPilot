import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';
import { param } from '../../shared/params';

import { noteService } from './note.service';

const getClerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

export const noteController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const notes = await noteService.list(getClerkId(req), param(req, 'id'));
    res.json({ success: true, data: notes });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const note = await noteService.create(getClerkId(req), param(req, 'id'), req.body);
    res.status(201).json({ success: true, data: note });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    await noteService.update(getClerkId(req), param(req, 'id'), param(req, 'noteId'), req.body);
    res.status(204).send();
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await noteService.delete(getClerkId(req), param(req, 'id'), param(req, 'noteId'));
    res.status(204).send();
  }),
};
