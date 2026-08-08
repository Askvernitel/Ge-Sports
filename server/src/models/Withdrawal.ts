import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const withdrawalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    destinationPubkey: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'confirmed', 'failed', 'refunded'],
      default: 'pending',
    },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    refundLedgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    signature: { type: String, default: null },
    // Base64-serialized signed transaction, kept so retries resend the SAME
    // signed tx rather than constructing + signing a new one (spec section 4).
    signedTxBase64: { type: String, default: null, select: false },
    lastError: { type: String, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });

export type WithdrawalDoc = HydratedDocument<InferSchemaType<typeof withdrawalSchema>>;
export const Withdrawal = model('Withdrawal', withdrawalSchema);
