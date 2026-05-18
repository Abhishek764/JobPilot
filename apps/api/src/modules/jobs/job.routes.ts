import { Schemas } from '@jobpilot/types';
import { Router, type Request, type Response } from 'express';

import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/async-handler';

import { jobService } from './job.service';

export const jobRouter: Router = Router();

jobRouter.use(requireAuth);

jobRouter.get(
  '/',
  validate(Schemas.ListJobsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as Schemas.ListJobsQuery;
    const { items, total } = await jobService.list(query);
    res.json({
      success: true,
      data: items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

jobRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const job = await jobService.getById(req.params.id!);
    res.json({ success: true, data: job });
  }),
);
