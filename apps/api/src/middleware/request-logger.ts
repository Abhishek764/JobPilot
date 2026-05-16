import type { NextFunction, Request, Response } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    req.log.info(
      { status: res.statusCode, durationMs: Number(durationMs.toFixed(2)) },
      'request completed',
    );
  });
  next();
};
