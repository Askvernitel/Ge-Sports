import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const ledgerEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'entry_fee', 'entry_refund', 'payout', 'rake', 'adjustment', 'bonus'],
      required: true,
    },
    amount: { type: Schema.Types.Decimal128, required: true }, // signed
    balanceAfter: { type: Schema.Types.Decimal128, required: true },
    refType: { type: String, enum: ['room', 'match', 'onchain_tx', 'manual'], required: true },
    refId: { type: String, default: null },
    // No default: null - see User.pubgAccountId comment for why (sparse
    // unique index only excludes fields that are entirely absent).
    idempotencyKey: { type: String },
    onchainSignature: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

ledgerEntrySchema.index({ userId: 1, createdAt: -1 });
ledgerEntrySchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
ledgerEntrySchema.index({ onchainSignature: 1 }, { sparse: true });
ledgerEntrySchema.index({ refType: 1, refId: 1 });

export type LedgerEntryDoc = HydratedDocument<InferSchemaType<typeof ledgerEntrySchema>>;
export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);
