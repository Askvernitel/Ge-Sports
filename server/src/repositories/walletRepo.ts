import { Wallet, type WalletDoc } from '../models/Wallet.js';
import type { ClientSession } from 'mongoose';

export const walletRepo = {
  async createForUser(userId: string, session?: ClientSession) {
    const [doc] = await Wallet.create([{ userId }], { session });
    return doc;
  },
  async findByUserId(userId: string, session?: ClientSession) {
    return Wallet.findOne({ userId }).session(session ?? null).exec();
  },
  /** Never returns null - creates the wallet on first access if one doesn't exist yet. */
  async findOrCreateForUser(userId: string, session?: ClientSession): Promise<WalletDoc> {
    const existing: WalletDoc | null = await Wallet.findOne({ userId }).session(session ?? null).exec();
    if (existing) return existing;
    const [created] = await Wallet.create([{ userId }], { session });
    if (!created) throw new Error('Failed to create wallet');
    return created;
  },
  async findById(id: string, session?: ClientSession) {
    return Wallet.findById(id).session(session ?? null).exec();
  },
  async findByLinkedPublicKey(pubkey: string) {
    return Wallet.findOne({ linkedPublicKey: pubkey }).exec();
  },
};
