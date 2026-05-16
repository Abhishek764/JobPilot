import { clerkMiddleware, getAuth, requireAuth as clerkRequireAuth } from '@clerk/express';
import type { NextFunction, Request, Response } from 'express';

import { UnauthorizedError } from '../shared/errors';

export const clerk = clerkMiddleware();

export const requireAuth = clerkRequireAuth();

export const attachUserId = (req: Request, _res: Response, next: NextFunction): void => {
  const { userId } = getAuth(req);
  if (!userId) {
    next(new UnauthorizedError());
    return;
  }
  (req as Request & { clerkUserId: string }).clerkUserId = userId;
  next();
};
