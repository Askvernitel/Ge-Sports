import mongoose from 'mongoose';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { roomRepo, type RoomListFilters } from '../repositories/roomRepo.js';
import { roomEntryRepo } from '../repositories/roomEntryRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { walletRepo } from '../repositories/walletRepo.js';
import { ledgerRepo } from '../repositories/ledgerRepo.js';
import { decimal128ToMinorUnits, minorUnitsToDecimal128, minorUnitsToDecimalString } from '../utils/money.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { getMatchVerificationQueue } from '../jobs/queues.js';
import { emitToRoom } from '../realtime/socket.js';

export interface CreateRoomInput {
  mode: 'solo' | 'duo' | 'squad';
  perspective: 'tpp' | 'fpp';
  map: 'erangel' | 'miramar' | 'sanhok' | 'vikendi' | 'any';
  region: string;
  entryFee: string;
  maxPlayers: number;
  minPlayers: number;
  payoutStructure: 'winner_take_all' | 'top3' | 'placement_points';
  skillBand?: { minRating: number; maxRating: number } | null;
  isPrivate?: boolean;
  password?: string | null;
  rakeBps?: number;
  scheduledStartAt?: string | null;
}

function shortCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export const roomService = {
  async create(userId: string, input: CreateRoomInput) {
    if (input.minPlayers < 1 || input.maxPlayers < input.minPlayers) {
      throw new AppError('VALIDATION_ERROR', 'Invalid min/max players');
    }
    const passwordHash = input.isPrivate && input.password ? await argon2.hash(input.password, { type: argon2.argon2id }) : null;

    const room = await roomRepo.create({
      code: shortCode(),
      createdBy: userId,
      status: 'open',
      config: {
        mode: input.mode,
        perspective: input.perspective,
        map: input.map,
        region: input.region,
        entryFee: input.entryFee,
        maxPlayers: input.maxPlayers,
        minPlayers: input.minPlayers,
        payoutStructure: input.payoutStructure,
        skillBand: input.skillBand ?? null,
        isPrivate: Boolean(input.isPrivate),
        passwordHash,
      },
      prizePool: '0',
      rakeBps: input.rakeBps ?? 500,
      scheduledStartAt: input.scheduledStartAt ? new Date(input.scheduledStartAt) : null,
    });
    return room;
  },

  async list(filters: RoomListFilters, query: { page?: unknown; limit?: unknown }) {
    const { page, limit } = parsePagination(query);
    const { items, total } = await roomRepo.list(filters, page, limit, roomEntryRepo.countForRooms);

    let filtered = items;
    if (filters.hasSpace) {
      const counts = await roomEntryRepo.countForRooms(items.map((r) => String(r._id)));
      filtered = items.filter((r) => (counts[String(r._id)] ?? 0) < r.config.maxPlayers);
    }
    return { items: filtered, meta: paginationMeta(page, limit, total) };
  },

  async getById(id: string) {
    const room = await roomRepo.findById(id);
    if (!room) throw new AppError('NOT_FOUND', 'Room not found');
    return room;
  },

  /** Participants currently in the room, joined with the user's display name. */
  async listEntries(roomId: string) {
    const entries = (await roomEntryRepo.listForRoom(roomId)).filter((e) =>
      ['joined', 'played'].includes(e.status),
    );
    const users = await userRepo.findByIds(entries.map((e) => String(e.userId)));
    const userById = new Map(users.map((u) => [String(u._id), u]));
    return entries.map((e) => {
      const user = userById.get(String(e.userId));
      return {
        userId: String(e.userId),
        name: user?.displayName ?? 'Player',
        pubgIgn: user?.pubgIgn ?? null,
        status: e.status === 'played' ? 'ALIVE' : 'JOINED',
      };
    });
  },

  /** Rooms a user currently has an active (joined) entry in, plus rooms they created. */
  async listMine(userId: string) {
    const entries = (await roomEntryRepo.listForUser(userId)).filter((e) => e.status === 'joined');
    const roomIds = [...new Set(entries.map((e) => String(e.roomId)))];
    if (roomIds.length === 0) return [];
    return roomRepo.findByIds(roomIds);
  },

  /**
   * Escrow a room entry fee: debit custodialBalance, credit lockedBalance,
   * write a ledger entry, all inside one Mongo transaction. Unique compound
   * index (roomId, userId) on RoomEntry prevents double-joins even under a
   * race.
   */
  async join(userId: string, roomId: string, password?: string) {
    const session = await mongoose.startSession();
    try {
      let entry: unknown;
      await session.withTransaction(async () => {
        const room = await roomRepo.findById(roomId, session);
        if (!room) throw new AppError('NOT_FOUND', 'Room not found');
        if (room.status !== 'open') throw new AppError('ROOM_NOT_JOINABLE', `Room is ${room.status}, not open`);

        if (room.config.isPrivate) {
          if (!password || !room.config.passwordHash || !(await argon2.verify(room.config.passwordHash, password))) {
            throw new AppError('FORBIDDEN', 'Invalid room password');
          }
        }

        const currentCount = await roomEntryRepo.countForRoom(roomId);
        if (currentCount >= room.config.maxPlayers) throw new AppError('ROOM_FULL', 'Room is full');

        const existing = await roomEntryRepo.findByRoomAndUser(roomId, userId, session);
        if (existing) throw new AppError('CONFLICT', 'Already joined this room');

        const wallet = await walletRepo.findByUserId(userId, session);
        if (!wallet) throw new AppError('NOT_FOUND', 'Wallet not found');

        const feeMinor = decimal128ToMinorUnits(room.config.entryFee);
        const custodialMinor = decimal128ToMinorUnits(wallet.custodialBalance);
        if (custodialMinor < feeMinor) throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient balance for entry fee');

        const newCustodial = custodialMinor - feeMinor;
        const newLocked = decimal128ToMinorUnits(wallet.lockedBalance) + feeMinor;

        await ledgerRepo.append(
          {
            userId,
            walletId: String(wallet._id),
            type: 'entry_fee',
            amount: minorUnitsToDecimalString(-feeMinor),
            balanceAfter: minorUnitsToDecimalString(newCustodial),
            refType: 'room',
            refId: roomId,
            idempotencyKey: `entry_fee:${roomId}:${userId}`,
          },
          session,
        );

        wallet.custodialBalance = minorUnitsToDecimal128(newCustodial);
        wallet.lockedBalance = minorUnitsToDecimal128(newLocked);
        await wallet.save({ session });

        const newEntry = await roomEntryRepo.create(
          { roomId, userId, entryFeeCharged: room.config.entryFee, status: 'joined' },
          session,
        );

        const newPrizePool = decimal128ToMinorUnits(room.prizePool) + feeMinor;
        room.prizePool = minorUnitsToDecimal128(newPrizePool);
        await room.save({ session });

        entry = newEntry;
      });
      emitToRoom(roomId, 'room:joined', { roomId, userId });
      return entry;
    } finally {
      await session.endSession();
    }
  },

  /** Refund if room is still open (or locked but not yet started). */
  async leave(userId: string, roomId: string) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const room = await roomRepo.findById(roomId, session);
        if (!room) throw new AppError('NOT_FOUND', 'Room not found');
        if (!['open', 'locked'].includes(room.status)) {
          throw new AppError('ROOM_NOT_JOINABLE', 'Room has already started - cannot leave');
        }

        const entry = await roomEntryRepo.findByRoomAndUser(roomId, userId, session);
        if (!entry || entry.status !== 'joined') throw new AppError('NOT_FOUND', 'No active entry in this room');

        const wallet = await walletRepo.findByUserId(userId, session);
        if (!wallet) throw new AppError('NOT_FOUND', 'Wallet not found');

        const feeMinor = decimal128ToMinorUnits(entry.entryFeeCharged);
        const newLocked = decimal128ToMinorUnits(wallet.lockedBalance) - feeMinor;
        const newCustodial = decimal128ToMinorUnits(wallet.custodialBalance) + feeMinor;
        if (newLocked < 0n) throw new AppError('CONFLICT', 'Locked balance underflow - inconsistent state');

        await ledgerRepo.append(
          {
            userId,
            walletId: String(wallet._id),
            type: 'entry_refund',
            amount: minorUnitsToDecimalString(feeMinor),
            balanceAfter: minorUnitsToDecimalString(newCustodial),
            refType: 'room',
            refId: roomId,
            idempotencyKey: `entry_refund:${roomId}:${userId}`,
          },
          session,
        );

        wallet.custodialBalance = minorUnitsToDecimal128(newCustodial);
        wallet.lockedBalance = minorUnitsToDecimal128(newLocked);
        await wallet.save({ session });

        entry.status = 'refunded';
        await entry.save({ session });

        const newPrizePool = decimal128ToMinorUnits(room.prizePool) - feeMinor;
        room.prizePool = minorUnitsToDecimal128(newPrizePool);
        await room.save({ session });
      });
      emitToRoom(roomId, 'room:left', { roomId, userId });
    } finally {
      await session.endSession();
    }
  },

  async start(userId: string, roomId: string) {
    const room = await roomRepo.findById(roomId);
    if (!room) throw new AppError('NOT_FOUND', 'Room not found');
    if (String(room.createdBy) !== userId) throw new AppError('FORBIDDEN', 'Only the creator can start this room');
    if (room.status !== 'open') throw new AppError('ROOM_NOT_JOINABLE', `Room is ${room.status}`);

    const count = await roomEntryRepo.countForRoom(roomId);
    if (count < room.config.minPlayers) {
      throw new AppError('VALIDATION_ERROR', `Need at least ${room.config.minPlayers} players to start`);
    }

    const now = new Date();
    const lockAt = now;
    const updated = await roomRepo.updateById(roomId, {
      status: 'in_progress',
      startedAt: now,
      lockAt,
    });

    const queue = getMatchVerificationQueue();
    await queue.add(
      'verify-match',
      { roomId },
      { delay: 2 * 60 * 1000, jobId: `verify-${roomId}`, attempts: 1 },
    );

    emitToRoom(roomId, 'room:started', { roomId });
    return updated;
  },
};
