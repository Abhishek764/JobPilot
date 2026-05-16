import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { logger } from '../config/logger';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    log: typeof logger;
  }
}

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.header('x-request-id') ?? randomUUID()).toString();
  req.requestId = requestId;
  req.log = logger.child({ requestId, method: req.method, path: req.path });
  res.setHeader('x-request-id', requestId);
  next();
};
