import { ScrapeJobSchema } from '@jobpilot/types/schemas';
import { Router, type Request, type Response } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/async-handler';

import { scraperService } from './scraper.service';

export const scraperRouter: Router = Router();

scraperRouter.use(requireAuth, attachUserId);

scraperRouter.post(
  '/jobs',
  validate(ScrapeJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const job = await scraperService.scrapeAndStore(req.body.url);
    res.status(201).json({ success: true, data: job });
  }),
);
