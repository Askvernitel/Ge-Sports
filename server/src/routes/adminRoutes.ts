import { Router } from 'express';
import { adminController, resolveDisputeSchema, suspendUserSchema } from '../controllers/adminController.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole('admin'));

adminRoutes.get('/rooms/disputed', asyncHandler(adminController.listDisputedRooms));
adminRoutes.post('/rooms/:id/resolve', idempotency(), validateBody(resolveDisputeSchema), asyncHandler(adminController.resolveDispute));
adminRoutes.get('/kyc/queue', asyncHandler(adminController.listKycQueue));
adminRoutes.post('/users/:id/suspend', idempotency(), validateBody(suspendUserSchema), asyncHandler(adminController.suspendUser));
