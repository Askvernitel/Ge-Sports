import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const onchainTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    direction: { type: String, enum: ['deposit', 'withdrawal'], required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    tokenMint: { type: String, required: true },
    fromPubkey: { type: String, required: true },
    toPubkey: { type: String, required: true },
    signature: { type: String, required: true },
    slot: { type: Number, default: null },
    confirmationStatus: { type: String, enum: ['processed', 'confirmed', 'finalized', null], default: null },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'finalized', 'failed', 'reversed'],
      default: 'pending',
    },
    detectedAt: { type: Date, default: () => new Date() },
    confirmedAt: { type: Date, default: null },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    failureReason: { type: String, default: null },
  },
  { timestamps: true },
);

onchainTransactionSchema.index({ signature: 1 }, { unique: true });
onchainTransactionSchema.index({ userId: 1, createdAt: -1 });
onchainTransactionSchema.index({ status: 1 });

export type OnchainTransactionDoc = HydratedDocument<InferSchemaType<typeof onchainTransactionSchema>>;
export const OnchainTransaction = model('OnchainTransaction', onchainTransactionSchema);
