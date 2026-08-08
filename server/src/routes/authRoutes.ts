import { Router } from 'express';
import { authController, registerSchema, loginSchema, verifyEmailSchema } from '../controllers/authController.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const authRoutes = Router();

const authLimiter = rateLimit({ windowSeconds: 60, max: 10, keyPrefix: 'auth' });

authRoutes.post('/register', authLimiter, validateBody(registerSchema), asyncHandler(authController.register));
authRoutes.post('/login', authLimiter, validateBody(loginSchema), asyncHandler(authController.login));
authRoutes.post('/refresh', authLimiter, asyncHandler(authController.refresh));
authRoutes.post('/logout', requireAuth, asyncHandler(authController.logout));
authRoutes.post('/verify-email', validateBody(verifyEmailSchema), asyncHandler(authController.verifyEmail));
