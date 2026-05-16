import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { isProduction } from '../config/env';
import { AppError } from '../shared/errors';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      requestId: req.requestId,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    req.log.warn({ err: err.flatten() }, 'validation error');
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten(),
        requestId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const logFn = err.statusCode >= 500 ? req.log.error : req.log.warn;
    logFn.bind(req.log)({ err, code: err.code }, err.message);
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  req.log.error({ err }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Internal server error' : (err as Error)?.message,
      requestId,
    },
  });
};
