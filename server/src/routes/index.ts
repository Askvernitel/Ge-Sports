import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { meRoutes } from './meRoutes.js';
import { walletRoutes } from './walletRoutes.js';
import { roomRoutes } from './roomRoutes.js';
import { matchRoutes } from './matchRoutes.js';
import { kycRoutes } from './kycRoutes.js';
import { adminRoutes } from './adminRoutes.js';
import { devRoutes } from './devRoutes.js';
import { isMongoConnected } from '../config/mongo.js';

export const rootRouter = Router();

rootRouter.get('/health', (_req, res) => {
  res.json({ ok: true, mongoConnected: isMongoConnected() });
});

rootRouter.use('/auth', authRoutes);
rootRouter.use('/me', meRoutes);
rootRouter.use('/wallet', walletRoutes);
rootRouter.use('/rooms', roomRoutes);
rootRouter.use('/matches', matchRoutes);
rootRouter.use('/kyc', kycRoutes);
rootRouter.use('/admin', adminRoutes);
rootRouter.use('/dev', devRoutes);
