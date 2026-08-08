import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from 'mongoose';

const roomConfigSchema = new Schema(
  {
    mode: { type: String, enum: ['solo', 'duo', 'squad'], required: true },
    perspective: { type: String, enum: ['tpp', 'fpp'], required: true },
    map: { type: String, enum: ['erangel', 'miramar', 'sanhok', 'vikendi', 'any'], default: 'any' },
    region: { type: String, required: true },
    entryFee: { type: Schema.Types.Decimal128, required: true },
    maxPlayers: { type: Number, required: true },
    minPlayers: { type: Number, required: true },
    payoutStructure: { type: String, enum: ['winner_take_all', 'top3', 'placement_points'], required: true },
    skillBand: {
      type: new Schema(
        { minRating: { type: Number }, maxRating: { type: Number } },
        { _id: false },
      ),
      default: null,
    },
    isPrivate: { type: Boolean, default: false },
    passwordHash: { type: String, default: null },
  },
  { _id: false },
);

const roomSchema = new Schema(
  {
    code: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['open', 'locked', 'in_progress', 'awaiting_results', 'settling', 'settled', 'cancelled', 'disputed'],
      default: 'open',
    },
    config: { type: roomConfigSchema, required: true },
    prizePool: { type: Schema.Types.Decimal128, required: true, default: () => Types.Decimal128.fromString('0') },
    rakeBps: { type: Number, required: true, default: 500 },
    scheduledStartAt: { type: Date, default: null },
    lockAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
    pubgMatchId: { type: String, default: null },
    resultSource: { type: String, enum: ['pubg_api', 'manual_review', null], default: null },
    disputeReason: { type: String, default: null },
  },
  { timestamps: true },
);

roomSchema.index({ status: 1, scheduledStartAt: 1 });
roomSchema.index({ code: 1 }, { unique: true });
roomSchema.index({ 'config.mode': 1, 'config.map': 1, 'config.region': 1, status: 1 });

export type RoomDoc = HydratedDocument<InferSchemaType<typeof roomSchema>>;
export const Room = model('Room', roomSchema);
