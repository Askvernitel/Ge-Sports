import { Router } from 'express';
import { roomController, createRoomSchema, listRoomsQuerySchema, joinRoomSchema } from '../controllers/roomController.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { kycGate } from '../middleware/kycGate.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const roomRoutes = Router();

const joinLimiter = rateLimit({ windowSeconds: 60, max: 20, keyPrefix: 'room-join' });

roomRoutes.get('/', validateQuery(listRoomsQuerySchema), asyncHandler(roomController.list));
roomRoutes.get('/mine', requireAuth, asyncHandler(roomController.mine));
roomRoutes.get('/:id', asyncHandler(roomController.getById));
roomRoutes.get('/:id/entries', asyncHandler(roomController.listEntries));

roomRoutes.post('/', requireAuth, idempotency(), validateBody(createRoomSchema), asyncHandler(roomController.create));
roomRoutes.post(
  '/:id/join',
  requireAuth,
  joinLimiter,
  idempotency(),
  kycGate('basic'),
  validateBody(joinRoomSchema),
  asyncHandler(roomController.join),
);
roomRoutes.post('/:id/leave', requireAuth, idempotency(), asyncHandler(roomController.leave));
roomRoutes.post('/:id/start', requireAuth, idempotency(), asyncHandler(roomController.start));
