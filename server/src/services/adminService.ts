import { AppError } from '../utils/AppError.js';
import { roomRepo } from '../repositories/roomRepo.js';
import { roomEntryRepo } from '../repositories/roomEntryRepo.js';
import { kycRepo } from '../repositories/kycRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { auditLogRepo } from '../repositories/auditLogRepo.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { settleRoom } from './settlementService.js';

export const adminService = {
  async listDisputedRooms(query: { page?: unknown; limit?: unknown }) {
    const { page, limit } = parsePagination(query);
    const { items, total } = await roomRepo.findDisputed(page, limit);
    return { items, meta: paginationMeta(page, limit, total) };
  },

  /**
   * Manual review resolution for a disputed room (spec section 5: manual
   * review is a fallback, not a primary mechanism). Admin either forces a
   * settlement with manually-entered placements, or confirms the refund
   * that verifyRoomMatch already issued.
   */
  async resolveDisputedRoom(
    adminUserId: string,
    roomId: string,
    action: { resolution: 'refund_confirmed' | 'manual_settle'; placements?: { userId: string; placement: number }[] },
    ip?: string | null,
  ) {
    const room = await roomRepo.findById(roomId);
    if (!room) throw new AppError('NOT_FOUND', 'Room not found');
    if (room.status !== 'disputed') throw new AppError('CONFLICT', 'Room is not in disputed state');

    if (action.resolution === 'refund_confirmed') {
      await roomRepo.updateById(roomId, { status: 'cancelled' });
    } else {
      if (!action.placements || action.placements.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Manual settlement requires placements');
      }
      for (const p of action.placements) {
        const entry = await roomEntryRepo.findByRoomAndUser(roomId, p.userId);
        if (entry) await roomEntryRepo.updateById(String(entry._id), { placement: p.placement, status: 'played' });
      }
      await roomRepo.updateById(roomId, { status: 'settling', resultSource: 'manual_review' });
      await settleRoom(roomId);
    }

    await auditLogRepo.record({
      actorUserId: adminUserId,
      action: `room.resolve_dispute:${action.resolution}`,
      targetType: 'Room',
      targetId: roomId,
      metadata: { placements: action.placements ?? null },
      ip,
    });

    return roomRepo.findById(roomId);
  },

  async listKycQueue(query: { page?: unknown; limit?: unknown }) {
    const { page, limit } = parsePagination(query);
    const { items, total } = await kycRepo.listPending(page, limit);
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async suspendUser(adminUserId: string, targetUserId: string, reason: string, ip?: string | null) {
    const user = await userRepo.updateById(targetUserId, { status: 'suspended' });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');

    await auditLogRepo.record({
      actorUserId: adminUserId,
      action: 'user.suspend',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { reason },
      ip,
    });
    return user;
  },
};
