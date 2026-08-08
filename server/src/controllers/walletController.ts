import { z } from 'zod';
import type { Request, Response } from 'express';
import { walletService } from '../services/walletService.js';
import { AppError } from '../utils/AppError.js';

export const linkWalletSchema = z.object({
  publicKey: z.string().min(32),
  message: z.string().min(1),
  signatureBase58: z.string().min(1),
});

export const claimDepositSchema = z.object({
  signature: z.string().min(1),
});

export const requestWithdrawalSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  destinationPubkey: z.string().min(32),
});

export const devFaucetSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/).default('100'),
});

function requireUser(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const walletController = {
  async link(req: Request, res: Response) {
    const user = requireUser(req);
    const wallet = await walletService.linkWallet(user.id, req.body);
    res.json({ wallet });
  },

  async getWallet(req: Request, res: Response) {
    const user = requireUser(req);
    const wallet = await walletService.getWallet(user.id);
    res.json({ wallet });
  },

  async getLedger(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await walletService.getLedger(user.id, req.query);
    res.json(result);
  },

  async claimDeposit(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await walletService.claimDeposit(user.id, req.body.signature);
    res.status(202).json(result);
  },

  async requestWithdrawal(req: Request, res: Response) {
    const user = requireUser(req);
    const withdrawal = await walletService.requestWithdrawal(user.id, req.body);
    res.status(202).json({ withdrawal });
  },

  async getWithdrawal(req: Request, res: Response) {
    const user = requireUser(req);
    const withdrawal = await walletService.getWithdrawal(user.id, req.params.id as string);
    res.json({ withdrawal });
  },

  async devFaucet(req: Request, res: Response) {
    const user = requireUser(req);
    const wallet = await walletService.devFaucet(user.id, req.body.amount);
    res.json({ wallet });
  },

  async getDepositInfo(_req: Request, res: Response) {
    res.json(walletService.getDepositInfo());
  },

  async chainFaucet(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await walletService.chainFaucet(user.id, req.body.amount);
    res.json(result);
  },
};
