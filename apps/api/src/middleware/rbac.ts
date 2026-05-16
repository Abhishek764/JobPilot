import type { Role } from '@jobpilot/types';
import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '../shared/errors';
import { userService } from '../modules/users/user.service';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; clerkId: string; role: Role; onboardedAt: Date | null };
  }
}

const loadUser = async (req: Request): Promise<NonNullable<Request['user']>> => {
  const clerkId = (req as Request & { clerkUserId?: string }).clerkUserId;
  if (!clerkId) throw new UnauthorizedError();
  if (req.user) return req.user;
  const user = await userService.getByClerkId(clerkId);
  req.user = {
    id: user.id,
    clerkId: user.clerkId,
    role: user.role as Role,
    onboardedAt: user.onboardedAt,
  };
  return req.user;
};

export const hydrateUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    await loadUser(req);
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...allowed: Role[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await loadUser(req);
      if (!allowed.includes(user.role)) throw new ForbiddenError('Insufficient role');
      next();
    } catch (err) {
      next(err);
    }
  };

export const requireOnboarded = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await loadUser(req);
    if (!user.onboardedAt) throw new ForbiddenError('Onboarding required');
    next();
  } catch (err) {
    next(err);
  }
};
