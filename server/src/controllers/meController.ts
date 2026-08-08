import { z } from 'zod';
import type { Request, Response } from 'express';
import { userService } from '../services/userService.js';
import { AppError } from '../utils/AppError.js';

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(32).optional(),
});

export const linkPubgSchema = z.object({
  pubgAccountId: z.string().min(1),
  pubgPlatform: z.enum(['steam', 'kakao', 'psn', 'xbox']),
  pubgIgn: z.string().min(1),
});

export const selfExcludeSchema = z.object({
  untilDate: z.string().datetime().optional(),
});

export const meController = {
  async getMe(req: Request, res: Response) {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
    const user = await userService.getById(req.user.id);
    res.json({ user });
  },

  async updateMe(req: Request, res: Response) {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
    const user = await userService.updateProfile(req.user.id, req.body);
    res.json({ user });
  },

  async linkPubgAccount(req: Request, res: Response) {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
    const result = await userService.linkPubgAccount(req.user.id, req.body);
    res.status(202).json(result);
  },

  async verifyPubgAccount(req: Request, res: Response) {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
    const user = await userService.verifyPubgAccount(req.user.id);
    res.json({ user });
  },

  async selfExclude(req: Request, res: Response) {
    if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
    const until = req.body.untilDate ? new Date(req.body.untilDate) : null;
    await userService.selfExclude(req.user.id, until);
    res.status(204).send();
  },
};
