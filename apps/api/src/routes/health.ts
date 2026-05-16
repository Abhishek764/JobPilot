import { prisma } from '@jobpilot/db';
import { Router, type Request, type Response } from 'express';

import { redis } from '../config/redis';
import { asyncHandler } from '../shared/async-handler';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

healthRouter.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    const checks = { db: 'unknown', redis: 'unknown' };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch {
      checks.db = 'down';
    }
    try {
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'down';
    } catch {
      checks.redis = 'down';
    }
    const allOk = Object.values(checks).every((s) => s === 'ok');
    res.status(allOk ? 200 : 503).json({ success: allOk, data: checks });
  }),
);
