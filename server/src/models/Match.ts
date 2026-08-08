import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const participantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pubgPlayerId: { type: String, required: true },
    placement: { type: Number, default: null },
    kills: { type: Number, default: null },
    damage: { type: Number, default: null },
    timeSurvived: { type: Number, default: null },
  },
  { _id: false },
);

const matchSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    pubgMatchId: { type: String, required: true },
    fetchedAt: { type: Date, default: () => new Date() },
    rawSummaryRef: { type: String, default: null },
    participants: { type: [participantSchema], default: [] },
    verificationStatus: { type: String, enum: ['verified', 'partial', 'failed'], required: true },
    discrepancies: { type: [String], default: [] },
  },
  { timestamps: true },
);

matchSchema.index({ roomId: 1 }, { unique: true });
matchSchema.index({ pubgMatchId: 1 });

export type MatchDoc = HydratedDocument<InferSchemaType<typeof matchSchema>>;
export const Match = model('Match', matchSchema);
