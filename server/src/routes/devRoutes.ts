import { Router } from 'express';
import { env } from '../config/env.js';
import { walletController, devFaucetSchema } from '../controllers/walletController.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import type { Request, Response, NextFunction } from 'express';

export const devRoutes = Router();

function devOnlyGate(_req: Request, _res: Response, next: NextFunction): void {
  if (env.NODE_ENV === 'production' || !env.FEATURE_DEV_FAUCET) {
    return next(new AppError('FORBIDDEN', 'Dev endpoints are disabled in this environment'));
  }
  next();
}

devRoutes.post('/faucet', devOnlyGate, requireAuth, validateBody(devFaucetSchema), asyncHandler(walletController.devFaucet));
devRoutes.post('/chain-faucet', devOnlyGate, requireAuth, validateBody(devFaucetSchema), asyncHandler(walletController.chainFaucet));
