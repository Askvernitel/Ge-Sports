import type { ClientSession } from 'mongoose';
import { LedgerEntry, type LedgerEntryDoc } from '../models/LedgerEntry.js';

export interface CreateLedgerEntryInput {
  userId: string;
  walletId: string;
  type: LedgerEntryDoc['type'];
  amount: string; // decimal string, signed
  balanceAfter: string;
  refType: LedgerEntryDoc['refType'];
  refId?: string | null;
  idempotencyKey?: string | null;
  onchainSignature?: string | null;
}

export const ledgerRepo = {
  async append(input: CreateLedgerEntryInput, session: ClientSession): Promise<LedgerEntryDoc> {
    const [doc] = await LedgerEntry.create(
      [
        {
          userId: input.userId,
          walletId: input.walletId,
          type: input.type,
          amount: input.amount,
          balanceAfter: input.balanceAfter,
          refType: input.refType,
          refId: input.refId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          onchainSignature: input.onchainSignature ?? null,
        },
      ],
      { session },
    );
    if (!doc) throw new Error('Failed to create LedgerEntry');
    return doc;
  },
  async findByOnchainSignature(signature: string) {
    return LedgerEntry.findOne({ onchainSignature: signature }).exec();
  },
  async findByIdempotencyKey(key: string) {
    return LedgerEntry.findOne({ idempotencyKey: key }).exec();
  },
  async listForUser(userId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      LedgerEntry.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      LedgerEntry.countDocuments({ userId }),
    ]);
    return { items, total };
  },
  async allForWalletCursor(walletId: string) {
    return LedgerEntry.find({ walletId }).select('amount type').lean().exec();
  },
};
