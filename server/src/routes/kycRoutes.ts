import { Router } from 'express';
import { kycController, createKycSessionSchema } from '../controllers/kycController.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';

export const kycRoutes = Router();

kycRoutes.post('/session', requireAuth, idempotency(), validateBody(createKycSessionSchema), asyncHandler(kycController.createSession));
kycRoutes.get('/status', requireAuth, asyncHandler(kycController.getStatus));
kycRoutes.post('/webhook', asyncHandler(kycController.webhook)); // signature-verified inside service, no requireAuth (external caller)
