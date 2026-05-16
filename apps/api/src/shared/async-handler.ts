import type { NextFunction, Request, Response } from 'express';

export type AsyncHandler<P = unknown, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  <P, ResBody, ReqBody, ReqQuery>(handler: AsyncHandler<P, ResBody, ReqBody, ReqQuery>) =>
  (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
