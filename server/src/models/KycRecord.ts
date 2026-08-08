import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const kycRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: true },
    providerRefId: { type: String, default: null },
    level: { type: String, enum: ['none', 'basic', 'full'], default: 'none' },
    status: {
      type: String,
      enum: ['not_started', 'pending', 'approved', 'rejected', 'expired'],
      default: 'not_started',
    },
    countryCode: { type: String, default: null },
    dateOfBirth: { type: Date, default: null },
    documentType: { type: String, default: null },
    sanctionsChecked: { type: Boolean, default: false },
    pepMatch: { type: Boolean, default: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    // Pointer only. Actual documents/PII live with the KYC vendor, never in Mongo.
    rawPayloadRef: { type: String, default: null },
  },
  { timestamps: true },
);

kycRecordSchema.index({ userId: 1, createdAt: -1 });
kycRecordSchema.index({ status: 1 });

export type KycRecordDoc = HydratedDocument<InferSchemaType<typeof kycRecordSchema>>;
export const KycRecord = model('KycRecord', kycRecordSchema);
export type KycLevel = 'none' | 'basic' | 'full';
