import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const auditLogSchema = new Schema(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export type AuditLogDoc = HydratedDocument<InferSchemaType<typeof auditLogSchema>>;
export const AuditLog = model('AuditLog', auditLogSchema);
