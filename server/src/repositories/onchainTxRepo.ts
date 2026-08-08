import type { ClientSession } from 'mongoose';
import { OnchainTransaction, type OnchainTransactionDoc } from '../models/OnchainTransaction.js';

export const onchainTxRepo = {
  async findBySignature(signature: string) {
    return OnchainTransaction.findOne({ signature }).exec();
  },
  async create(data: Record<string, unknown>, session?: ClientSession): Promise<OnchainTransactionDoc> {
    const [doc] = await OnchainTransaction.create([data], { session });
    if (!doc) throw new Error('Failed to create OnchainTransaction');
    return doc;
  },
  async updateById(id: string, update: Record<string, unknown>, session?: ClientSession) {
    return OnchainTransaction.findByIdAndUpdate(id, update, { new: true, session }).exec();
  },
};
