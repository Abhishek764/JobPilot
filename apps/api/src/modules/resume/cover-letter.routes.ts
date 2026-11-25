import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/async-handler';
import { param } from '../../shared/params';

import { coverLetterService } from './cover-letter.service';

const clerkId = (req: Request): string => (req as Request & { clerkUserId: string }).clerkUserId;

const ListCoverLettersQuerySchema = z.object({
  jobId: z.string().cuid().optional(),
  resumeId: z.string().cuid().optional(),
});

export const coverLetterRouter: Router = Router();

coverLetterRouter.use(requireAuth, attachUserId);

coverLetterRouter.get(
  '/',
  validate(ListCoverLettersQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await coverLetterService.list(
      clerkId(req),
      req.query as z.infer<typeof ListCoverLettersQuerySchema>,
    );
    res.json({ success: true, data });
  }),
);

coverLetterRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await coverLetterService.get(clerkId(req), param(req, 'id'));
    res.json({ success: true, data });
  }),
);
