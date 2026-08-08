import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { AppError } from '../utils/AppError.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing bearer token'));
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = authService.verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Array<'user' | 'admin' | 'support'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError('UNAUTHORIZED', 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new AppError('FORBIDDEN', 'Insufficient permissions'));
    next();
  };
}
