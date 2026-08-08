import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const roomEntrySchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: () => new Date() },
    entryFeeCharged: { type: Schema.Types.Decimal128, required: true },
    status: {
      type: String,
      enum: ['joined', 'refunded', 'no_show', 'played', 'disqualified'],
      default: 'joined',
    },
    placement: { type: Number, default: null },
    kills: { type: Number, default: null },
    pointsAwarded: { type: Number, default: null },
    payoutAmount: { type: Schema.Types.Decimal128, default: null },
    ipAddress: { type: String, default: null, select: false },
    deviceFingerprint: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

roomEntrySchema.index({ roomId: 1, userId: 1 }, { unique: true });
roomEntrySchema.index({ userId: 1 });

export type RoomEntryDoc = HydratedDocument<InferSchemaType<typeof roomEntrySchema>>;
export const RoomEntry = model('RoomEntry', roomEntrySchema);
