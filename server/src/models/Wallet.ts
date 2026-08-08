import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from 'mongoose';

const walletSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    custodialBalance: { type: Schema.Types.Decimal128, required: true, default: () => Types.Decimal128.fromString('0') },
    lockedBalance: { type: Schema.Types.Decimal128, required: true, default: () => Types.Decimal128.fromString('0') },
    linkedPublicKey: { type: String, default: null },
    linkedAt: { type: Date, default: null },
    linkSignature: { type: String, default: null },
    lifetimeDeposited: { type: Schema.Types.Decimal128, required: true, default: () => Types.Decimal128.fromString('0') },
    lifetimeWithdrawn: { type: Schema.Types.Decimal128, required: true, default: () => Types.Decimal128.fromString('0') },
  },
  { timestamps: true },
);

walletSchema.index({ userId: 1 }, { unique: true });
walletSchema.index({ linkedPublicKey: 1 }, { sparse: true });

export type WalletDoc = HydratedDocument<InferSchemaType<typeof walletSchema>>;
export const Wallet = model('Wallet', walletSchema);
