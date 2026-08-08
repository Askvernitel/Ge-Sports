import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerifiedAt: { type: Date, default: null },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['user', 'admin', 'support'], default: 'user' },
    status: {
      type: String,
      enum: ['active', 'suspended', 'closed', 'self_excluded'],
      default: 'active',
    },
    selfExcludedUntil: { type: Date, default: null },

    // No `default: null` on purpose: Mongo's sparse unique index only
    // excludes documents where the field is entirely absent, not where it's
    // explicitly null. Defaulting to null would make every unlinked user
    // collide on the same {null, null} compound key.
    pubgAccountId: { type: String },
    pubgPlatform: { type: String, enum: ['steam', 'kakao', 'psn', 'xbox'] },
    pubgLinkedAt: { type: Date, default: null },
    pubgLinkVerificationToken: { type: String, default: null, select: false },
    pubgLinkVerifiedAt: { type: Date, default: null },
    pubgIgn: { type: String, default: null },

    emailVerificationToken: { type: String, default: null, select: false },
    refreshTokenFamily: { type: String, default: null, select: false },
    refreshTokenVersion: { type: Number, default: 0, select: false },

    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ pubgAccountId: 1, pubgPlatform: 1 }, { unique: true, sparse: true });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
