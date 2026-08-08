import { Router } from 'express';
import { meController, updateProfileSchema, linkPubgSchema, selfExcludeSchema } from '../controllers/meController.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';

export const meRoutes = Router();

meRoutes.use(requireAuth);

meRoutes.get('/', asyncHandler(meController.getMe));
meRoutes.patch('/', idempotency(), validateBody(updateProfileSchema), asyncHandler(meController.updateMe));
meRoutes.post('/pubg-account/link', idempotency(), validateBody(linkPubgSchema), asyncHandler(meController.linkPubgAccount));
meRoutes.post('/pubg-account/verify', idempotency(), asyncHandler(meController.verifyPubgAccount));
meRoutes.post('/self-exclude', idempotency(), validateBody(selfExcludeSchema), asyncHandler(meController.selfExclude));
