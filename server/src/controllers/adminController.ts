import { z } from 'zod';
import type { Request, Response } from 'express';
import { adminService } from '../services/adminService.js';
import { AppError } from '../utils/AppError.js';

export const resolveDisputeSchema = z.object({
  resolution: z.enum(['refund_confirmed', 'manual_settle']),
  placements: z.array(z.object({ userId: z.string(), placement: z.number().int().positive() })).optional(),
});

export const suspendUserSchema = z.object({
  reason: z.string().min(1),
});

function requireUser(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const adminController = {
  async listDisputedRooms(req: Request, res: Response) {
    const result = await adminService.listDisputedRooms(req.query);
    res.json(result);
  },

  async resolveDispute(req: Request, res: Response) {
    const admin = requireUser(req);
    const room = await adminService.resolveDisputedRoom(admin.id, req.params.id as string, req.body, req.ip);
    res.json({ room });
  },

  async listKycQueue(req: Request, res: Response) {
    const result = await adminService.listKycQueue(req.query);
    res.json(result);
  },

  async suspendUser(req: Request, res: Response) {
    const admin = requireUser(req);
    const user = await adminService.suspendUser(admin.id, req.params.id as string, req.body.reason, req.ip);
    res.json({ user });
  },
};
