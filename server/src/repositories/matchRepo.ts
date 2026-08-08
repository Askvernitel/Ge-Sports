import type { ClientSession } from 'mongoose';
import { Match, type MatchDoc } from '../models/Match.js';

export const matchRepo = {
  async upsertForRoom(roomId: string, data: Record<string, unknown>, session?: ClientSession) {
    return Match.findOneAndUpdate({ roomId }, data, { upsert: true, new: true, session }).exec();
  },
  async findByRoomId(roomId: string, session?: ClientSession) {
    return Match.findOne({ roomId }).session(session ?? null).exec();
  },
  async findById(id: string) {
    return Match.findById(id).exec();
  },
};
