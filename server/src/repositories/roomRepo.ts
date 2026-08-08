import type { ClientSession, FilterQuery } from 'mongoose';
import { Room, type RoomDoc } from '../models/Room.js';

export interface RoomListFilters {
  mode?: string;
  perspective?: string;
  map?: string;
  region?: string;
  minFee?: number;
  maxFee?: number;
  status?: string;
  hasSpace?: boolean;
  skillBand?: number;
}

export const roomRepo = {
  async create(data: Record<string, unknown>, session?: ClientSession): Promise<RoomDoc> {
    const [doc] = await Room.create([data], { session });
    if (!doc) throw new Error('Failed to create Room');
    return doc;
  },
  async findById(id: string, session?: ClientSession) {
    return Room.findById(id).session(session ?? null).exec();
  },
  async findByIds(ids: string[]) {
    return Room.find({ _id: { $in: ids } }).exec();
  },
  async findByCode(code: string) {
    return Room.findOne({ code }).exec();
  },
  async list(filters: RoomListFilters, page: number, limit: number, currentEntryCounts: (roomIds: string[]) => Promise<Record<string, number>>) {
    const query: FilterQuery<RoomDoc> = {};
    if (filters.mode) query['config.mode'] = filters.mode;
    if (filters.perspective) query['config.perspective'] = filters.perspective;
    if (filters.map) query['config.map'] = filters.map;
    if (filters.region) query['config.region'] = filters.region;
    if (filters.status) query.status = filters.status;
    if (filters.minFee !== undefined || filters.maxFee !== undefined) {
      query['config.entryFee'] = {};
      if (filters.minFee !== undefined) (query['config.entryFee'] as Record<string, unknown>).$gte = filters.minFee.toString();
      if (filters.maxFee !== undefined) (query['config.entryFee'] as Record<string, unknown>).$lte = filters.maxFee.toString();
    }
    if (filters.skillBand !== undefined) {
      query.$or = [
        { 'config.skillBand': null },
        {
          'config.skillBand.minRating': { $lte: filters.skillBand },
          'config.skillBand.maxRating': { $gte: filters.skillBand },
        },
      ];
    }

    const [items, total] = await Promise.all([
      Room.find(query)
        .sort({ scheduledStartAt: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      Room.countDocuments(query),
    ]);
    void currentEntryCounts; // hasSpace filtering applied by service layer (needs entry counts)
    return { items, total };
  },
  async updateById(id: string, update: Record<string, unknown>, session?: ClientSession) {
    return Room.findByIdAndUpdate(id, update, { new: true, session }).exec();
  },
  async findDisputed(page: number, limit: number) {
    const query = { status: 'disputed' };
    const [items, total] = await Promise.all([
      Room.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      Room.countDocuments(query),
    ]);
    return { items, total };
  },
  async findLockedPastTimeout(cutoff: Date) {
    return Room.find({ status: { $in: ['locked', 'in_progress', 'awaiting_results'] }, lockAt: { $lte: cutoff } }).exec();
  },
};
