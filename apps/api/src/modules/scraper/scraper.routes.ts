import { Schemas } from '@jobpilot/types';
import { Router, type Request, type Response } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/async-handler';
import { registerScrapers } from './sources';

import { scrapeOrchestrator } from './scrape-orchestrator';
import { scrapeRunRepository } from './scrape-run.repository';
import { scrapeSourceRepository } from './scrape-source.repository';
import { syncScheduledSources } from '../queue/scheduler';
import { scraperService } from './scraper.service';

registerScrapers();

export const scraperRouter: Router = Router();

scraperRouter.use(requireAuth, attachUserId);

scraperRouter.post(
  '/jobs',
  validate(Schemas.ScrapeJobSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const job = await scraperService.scrapeAndStore(req.body.url);
    res.status(201).json({ success: true, data: job });
  }),
);

scraperRouter.post(
  '/runs',
  requireRole('ADMIN'),
  validate(Schemas.TriggerScrapeRunSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as Schemas.TriggerScrapeRunInput;
    const triggeredBy = (req as Request & { user?: { id: string } }).user?.id;
    const run = await scrapeOrchestrator.trigger({ ...input, triggeredBy });
    res.status(202).json({ success: true, data: run });
  }),
);

scraperRouter.get(
  '/runs',
  requireRole('ADMIN'),
  validate(Schemas.ListScrapeRunsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Schemas.ListScrapeRunsQuery;
    const { items, total } = await scrapeRunRepository.list(query);
    res.json({
      success: true,
      data: items,
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  }),
);

scraperRouter.get(
  '/sources',
  requireRole('ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const items = await scrapeSourceRepository.list();
    res.json({ success: true, data: items });
  }),
);

scraperRouter.put(
  '/sources',
  requireRole('ADMIN'),
  validate(Schemas.UpsertScrapeSourceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const source = await scrapeSourceRepository.upsert(req.body);
    res.status(200).json({ success: true, data: source });
  }),
);

scraperRouter.post(
  '/scheduler/sync',
  requireRole('ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    await syncScheduledSources();
    res.json({ success: true });
  }),
);
