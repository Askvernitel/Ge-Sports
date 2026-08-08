import type { Request, Response } from 'express';
import { matchRepo } from '../repositories/matchRepo.js';
import { AppError } from '../utils/AppError.js';

export const matchController = {
  async getById(req: Request, res: Response) {
    const match = await matchRepo.findById(req.params.id as string);
    if (!match) throw new AppError('NOT_FOUND', 'Match not found');
    res.json({ match });
  },
};
