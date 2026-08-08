import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

// Fallback store for the idempotency middleware when Redis is unavailable,
// and durable audit trail of idempotent responses either way.
const idempotencyRecordSchema = new Schema(
  {
    key: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    method: { type: String, required: true },
    path: { type: String, required: true },
    requestHash: { type: String, required: true },
    responseStatus: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

idempotencyRecordSchema.index({ key: 1, method: 1, path: 1 }, { unique: true });
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type IdempotencyRecordDoc = HydratedDocument<InferSchemaType<typeof idempotencyRecordSchema>>;
export const IdempotencyRecord = model('IdempotencyRecord', idempotencyRecordSchema);
