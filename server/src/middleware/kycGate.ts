import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { kycRepo } from '../repositories/kycRepo.js';
import { userRepo } from '../repositories/userRepo.js';

const LEVEL_RANK: Record<'none' | 'basic' | 'full', number> = { none: 0, basic: 1, full: 2 };

/**
 * Judgment call (spec doesn't pin exact thresholds): require KYC level
 * 'basic' to join a paid room, 'full' to withdraw. Also blocks self-excluded
 * or suspended accounts from both actions.
 */
export function kycGate(requiredLevel: 'basic' | 'full') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');

      const user = await userRepo.findById(req.user.id);
      if (!user) throw new AppError('NOT_FOUND', 'User not found');
      if (user.status === 'self_excluded') throw new AppError('SELF_EXCLUDED', 'This account is self-excluded');
      if (user.status !== 'active') throw new AppError('FORBIDDEN', `Account is ${user.status}`);

      const record = await kycRepo.findLatestForUser(req.user.id);
      const level = (record?.status === 'approved' ? record.level : 'none') as 'none' | 'basic' | 'full';

      if (LEVEL_RANK[level] < LEVEL_RANK[requiredLevel]) {
        throw new AppError('KYC_REQUIRED', `This action requires KYC level '${requiredLevel}' (current: '${level}')`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
