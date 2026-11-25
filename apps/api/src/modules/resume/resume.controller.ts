import type { Request, Response } from 'express';

import { asyncHandler } from '../../shared/async-handler';
import { param } from '../../shared/params';

import { analysisService } from './analysis.service';
import { coverLetterService } from './cover-letter.service';
import { resumeService } from './resume.service';

const clerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

export const resumeController = {
  createUpload: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await resumeService.createUpload(clerkId(req), req.body);
    res.status(201).json({ success: true, data: ticket });
  }),

  ingest: asyncHandler(async (req: Request, res: Response) => {
    const resume = await resumeService.ingest(clerkId(req), param(req, 'id'));
    res.status(202).json({ success: true, data: resume });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await resumeService.list(clerkId(req), req.query as never);
    res.json({ success: true, data: result });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const resume = await resumeService.get(clerkId(req), param(req, 'id'));
    res.json({ success: true, data: resume });
  }),

  download: asyncHandler(async (req: Request, res: Response) => {
    const url = await resumeService.downloadUrl(clerkId(req), param(req, 'id'));
    res.json({ success: true, data: { url } });
  }),

  createCoverLetter: asyncHandler(async (req: Request, res: Response) => {
    const letter = await coverLetterService.create(clerkId(req), param(req, 'id'), req.body);
    res.status(202).json({ success: true, data: letter });
  }),

  createAnalysis: asyncHandler(async (req: Request, res: Response) => {
    const analysis = await analysisService.create(clerkId(req), param(req, 'id'), req.body);
    res.status(202).json({ success: true, data: analysis });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await resumeService.remove(clerkId(req), param(req, 'id'));
    res.status(204).end();
  }),
};
