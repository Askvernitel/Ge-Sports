import { z } from 'zod';
import type { Request, Response } from 'express';
import { kycService } from '../services/kycService.js';
import { AppError } from '../utils/AppError.js';

export const createKycSessionSchema = z.object({
  forceDecision: z.enum(['approved', 'rejected']).optional(),
});

function requireUser(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const kycController = {
  async createSession(req: Request, res: Response) {
    const user = requireUser(req);
    const session = await kycService.createSession(user.id, req.body.forceDecision);
    res.status(201).json({ session });
  },

  async getStatus(req: Request, res: Response) {
    const user = requireUser(req);
    const status = await kycService.getStatus(user.id);
    res.json(status);
  },

  async webhook(req: Request, res: Response) {
    const result = await kycService.handleWebhook(req.header('X-Kyc-Signature'), req.body);
    res.json(result);
  },
};
