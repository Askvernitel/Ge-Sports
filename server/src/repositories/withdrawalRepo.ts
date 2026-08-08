import type { ClientSession } from 'mongoose';
import { Withdrawal, type WithdrawalDoc } from '../models/Withdrawal.js';

export const withdrawalRepo = {
  async create(data: Record<string, unknown>, session?: ClientSession): Promise<WithdrawalDoc> {
    const [doc] = await Withdrawal.create([data], { session });
    if (!doc) throw new Error('Failed to create Withdrawal');
    return doc;
  },
  async findById(id: string, opts: { withSignedTx?: boolean } = {}) {
    const q = Withdrawal.findById(id);
    if (opts.withSignedTx) q.select('+signedTxBase64');
    return q.exec();
  },
  async updateById(id: string, update: Record<string, unknown>, session?: ClientSession) {
    return Withdrawal.findByIdAndUpdate(id, update, { new: true, session }).exec();
  },
  async listForUser(userId: string) {
    return Withdrawal.find({ userId }).sort({ createdAt: -1 }).exec();
  },
};
