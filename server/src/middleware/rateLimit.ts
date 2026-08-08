import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis.js';
import { logger } from '../config/logger.js';

/**
 * Fixed-window rate limiter backed by Redis (INCR + EXPIRE). Fails open (lets
 * the request through, logging a warning) if Redis is unreachable, so an
 * infra hiccup degrades security posture rather than taking the API down.
 */
export function rateLimit(opts: { windowSeconds: number; max: number; keyPrefix: string }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = req.user?.id ?? req.ip ?? 'anonymous';
      const key = `ratelimit:${opts.keyPrefix}:${identity}`;
      const redis = getRedis();
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, opts.windowSeconds);
      if (count > opts.max) {
        res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } });
        return;
      }
      next();
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Rate limiter failed open (Redis unavailable)');
      next();
    }
  };
}
