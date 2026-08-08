import { z } from 'zod';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { authService } from '../services/authService.js';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(32),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(1),
});

const REFRESH_COOKIE = 'refreshToken';
const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
};

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    res.status(201).json({ userId: result.userId });
  },

  async login(req: Request, res: Response) {
    const { accessToken, refreshToken, user } = await authService.login({ ...req.body, ip: req.ip });
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    res.json({ accessToken, user: { id: String(user._id), email: user.email, displayName: user.displayName, role: user.role } });
  },

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    const { accessToken, refreshToken } = await authService.refresh(token);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    res.json({ accessToken });
  },

  async logout(req: Request, res: Response) {
    if (req.user) await authService.logout(req.user.id);
    res.clearCookie(REFRESH_COOKIE);
    res.status(204).send();
  },

  async verifyEmail(req: Request, res: Response) {
    await authService.verifyEmail(req.body.userId, req.body.token);
    res.status(204).send();
  },
};
