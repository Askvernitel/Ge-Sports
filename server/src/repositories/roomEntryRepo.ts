import type { ClientSession } from 'mongoose';
import { RoomEntry, type RoomEntryDoc } from '../models/RoomEntry.js';

export const roomEntryRepo = {
  async create(data: Record<string, unknown>, session?: ClientSession): Promise<RoomEntryDoc> {
    const [doc] = await RoomEntry.create([data], { session });
    if (!doc) throw new Error('Failed to create RoomEntry');
    return doc;
  },
  async findByRoomAndUser(roomId: string, userId: string, session?: ClientSession) {
    return RoomEntry.findOne({ roomId, userId }).session(session ?? null).exec();
  },
  async listForRoom(roomId: string, session?: ClientSession) {
    return RoomEntry.find({ roomId }).session(session ?? null).exec();
  },
  async countForRoom(roomId: string) {
    return RoomEntry.countDocuments({ roomId, status: 'joined' });
  },
  async countForRooms(roomIds: string[]): Promise<Record<string, number>> {
    const rows = await RoomEntry.aggregate([
      { $match: { roomId: { $in: roomIds }, status: 'joined' } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);
    const out: Record<string, number> = {};
    for (const row of rows) out[String(row._id)] = row.count;
    return out;
  },
  async updateById(id: string, update: Record<string, unknown>, session?: ClientSession) {
    return RoomEntry.findByIdAndUpdate(id, update, { new: true, session }).exec();
  },
  async listForUser(userId: string) {
    return RoomEntry.find({ userId }).sort({ createdAt: -1 }).exec();
  },
};
