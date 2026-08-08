import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-Id');
  req.requestId = incoming ?? randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
