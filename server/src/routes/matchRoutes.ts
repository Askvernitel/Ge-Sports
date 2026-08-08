import { Router } from 'express';
import { matchController } from '../controllers/matchController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const matchRoutes = Router();

matchRoutes.get('/:id', asyncHandler(matchController.getById));
