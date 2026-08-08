import { z } from 'zod';
import type { Request, Response } from 'express';
import { roomService } from '../services/roomService.js';
import { AppError } from '../utils/AppError.js';

export const createRoomSchema = z.object({
  mode: z.enum(['solo', 'duo', 'squad']),
  perspective: z.enum(['tpp', 'fpp']),
  map: z.enum(['erangel', 'miramar', 'sanhok', 'vikendi', 'any']).default('any'),
  region: z.string().min(1),
  entryFee: z.string().regex(/^\d+(\.\d+)?$/),
  maxPlayers: z.number().int().positive(),
  minPlayers: z.number().int().positive(),
  payoutStructure: z.enum(['winner_take_all', 'top3', 'placement_points']),
  skillBand: z.object({ minRating: z.number(), maxRating: z.number() }).nullable().optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().min(4).optional(),
  rakeBps: z.number().int().min(0).max(10000).optional(),
  scheduledStartAt: z.string().datetime().optional(),
});

export const listRoomsQuerySchema = z.object({
  mode: z.string().optional(),
  perspective: z.string().optional(),
  map: z.string().optional(),
  region: z.string().optional(),
  minFee: z.coerce.number().optional(),
  maxFee: z.coerce.number().optional(),
  status: z.string().optional(),
  hasSpace: z.coerce.boolean().optional(),
  skillBand: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

export const joinRoomSchema = z.object({
  password: z.string().optional(),
});

function requireUser(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const roomController = {
  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const room = await roomService.create(user.id, req.body);
    res.status(201).json({ room });
  },

  async list(req: Request, res: Response) {
    const q = req.query as Record<string, unknown>;
    const result = await roomService.list(
      {
        mode: q.mode as string | undefined,
        perspective: q.perspective as string | undefined,
        map: q.map as string | undefined,
        region: q.region as string | undefined,
        minFee: q.minFee as number | undefined,
        maxFee: q.maxFee as number | undefined,
        status: q.status as string | undefined,
        hasSpace: q.hasSpace as boolean | undefined,
        skillBand: q.skillBand as number | undefined,
      },
      q,
    );
    res.json(result);
  },

  async getById(req: Request, res: Response) {
    const room = await roomService.getById(req.params.id as string);
    res.json({ room });
  },

  async listEntries(req: Request, res: Response) {
    const items = await roomService.listEntries(req.params.id as string);
    res.json({ items });
  },

  async mine(req: Request, res: Response) {
    const user = requireUser(req);
    const items = await roomService.listMine(user.id);
    res.json({ items });
  },

  async join(req: Request, res: Response) {
    const user = requireUser(req);
    const entry = await roomService.join(user.id, req.params.id as string, req.body.password);
    res.status(201).json({ entry });
  },

  async leave(req: Request, res: Response) {
    const user = requireUser(req);
    await roomService.leave(user.id, req.params.id as string);
    res.status(204).send();
  },

  async start(req: Request, res: Response) {
    const user = requireUser(req);
    const room = await roomService.start(user.id, req.params.id as string);
    res.json({ room });
  },
};
