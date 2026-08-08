import type { Request, Response, NextFunction } from 'express';
import { sha256Hex } from '../utils/crypto.js';
import { idempotencyRepo } from '../repositories/idempotencyRepo.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Every mutating endpoint accepts an `Idempotency-Key` header (spec section
 * 7). Stores key -> response for 24h in Mongo (survives restarts; a Redis
 * cache could front this for speed but correctness only needs one durable
 * store). Replays the stored response for a repeat request with the same
 * key + method + path; if the same key is reused with a materially
 * different request body, rejects with a conflict rather than silently
 * returning the old response.
 */
export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    if (!key) return next();

    const requestHash = sha256Hex(JSON.stringify(req.body ?? {}));

    try {
      const existing = await idempotencyRepo.find(key, req.method, req.path);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return next(new AppError('IDEMPOTENCY_MISMATCH', 'Idempotency-Key was reused with a different request body'));
        }
        res.status(existing.responseStatus).json(existing.responseBody);
        return;
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Idempotency lookup failed - proceeding without replay protection for this request');
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      idempotencyRepo
        .save({
          key,
          userId: req.user?.id ?? null,
          method: req.method,
          path: req.path,
          requestHash,
          responseStatus: res.statusCode,
          responseBody: body,
          ttlMs: TTL_MS,
        })
        .catch((err) => logger.warn({ err: (err as Error).message }, 'Failed to persist idempotency record'));
      return originalJson(body);
    };

    next();
  };
}
