import { User, type UserDoc } from '../models/User.js';
import type { ClientSession } from 'mongoose';

export const userRepo = {
  async create(data: Record<string, unknown>, session?: ClientSession): Promise<UserDoc> {
    const [doc] = await User.create([data], { session });
    if (!doc) throw new Error('Failed to create User');
    return doc;
  },
  async findByEmail(email: string, opts: { withPasswordHash?: boolean } = {}) {
    const q = User.findOne({ email: email.toLowerCase() });
    if (opts.withPasswordHash) q.select('+passwordHash');
    return q.exec();
  },
  async findById(id: string, opts: { withPasswordHash?: boolean } = {}) {
    const q = User.findById(id);
    if (opts.withPasswordHash) q.select('+passwordHash');
    return q.exec();
  },
  async findByIds(ids: string[]) {
    return User.find({ _id: { $in: ids } }).exec();
  },
  async findByIdWithVerificationToken(id: string) {
    return User.findById(id).select('+emailVerificationToken +pubgLinkVerificationToken').exec();
  },
  async findByIdWithRefreshTokenFields(id: string) {
    return User.findById(id).select('+refreshTokenFamily +refreshTokenVersion').exec();
  },
  async findByPubgAccount(pubgAccountId: string, pubgPlatform: string) {
    return User.findOne({ pubgAccountId, pubgPlatform }).exec();
  },
  async updateById(id: string, update: Record<string, unknown>, session?: ClientSession) {
    return User.findByIdAndUpdate(id, update, { new: true, session }).exec();
  },
  async setRefreshTokenVersion(id: string, family: string, version: number) {
    return User.findByIdAndUpdate(id, { refreshTokenFamily: family, refreshTokenVersion: version }).exec();
  },
};
