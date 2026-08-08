import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';

/**
 * The ONLY place that formats error responses. Controllers/services throw
 * AppError (or let ZodError/unexpected errors bubble) and this middleware
 * maps everything to a consistent JSON shape.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error({ err, requestId: req.requestId, code: err.code }, err.publicMessage);
    }
    res.status(err.httpStatus).json({
      error: { code: err.code, message: err.publicMessage, requestId: req.requestId, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId: req.requestId,
        details: err.flatten(),
      },
    });
    return;
  }

  logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: req.requestId },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', requestId: req.requestId } });
}
