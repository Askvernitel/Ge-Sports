import mongoose from 'mongoose';
import { logger } from '../config/logger.js';
import { roomRepo } from '../repositories/roomRepo.js';
import { roomEntryRepo } from '../repositories/roomEntryRepo.js';
import { userRepo } from '../repositories/userRepo.js';
import { matchRepo } from '../repositories/matchRepo.js';
import { ledgerRepo } from '../repositories/ledgerRepo.js';
import { walletRepo } from '../repositories/walletRepo.js';
import { pubgProvider } from './pubg/index.js';
import { decimal128ToMinorUnits, minorUnitsToDecimal128, minorUnitsToDecimalString } from '../utils/money.js';
import { emitToRoom } from '../realtime/socket.js';
import type { PubgPlatform } from './pubg/PubgProvider.js';

/**
 * Core algorithm from spec section 5:
 *   1. After lockAt, poll recent matches for all room participants.
 *   2. Find the match ID that appears in EVERY participant's recent list
 *      (intersection) and was created after the room started.
 *   3. Fetch that match's full detail and parse placement/kills/damage/survival.
 *   4. If no match is found within the timeout window, move the room to
 *      'disputed' and refund entries. Never guess.
 */
export async function verifyRoomMatch(roomId: string): Promise<void> {
  const room = await roomRepo.findById(roomId);
  if (!room) return;
  if (!['in_progress', 'awaiting_results'].includes(room.status)) return;

  await roomRepo.updateById(roomId, { status: 'awaiting_results' });

  const entries = await roomEntryRepo.listForRoom(roomId);
  const joined = entries.filter((e) => e.status === 'joined');
  const users = await Promise.all(joined.map((e) => userRepo.findById(String(e.userId))));

  const linked = joined
    .map((e, idx) => ({ entry: e, user: users[idx] }))
    .filter((x) => x.user?.pubgAccountId && x.user.pubgLinkVerifiedAt);

  if (linked.length === 0) {
    logger.warn({ roomId }, 'No verified PUBG accounts among room participants - disputing room');
    await disputeAndRefund(roomId, 'No participants had a verified PUBG account link');
    return;
  }

  const platform = (linked[0]?.user?.pubgPlatform ?? 'steam') as PubgPlatform;
  const playerIds = linked.map((x) => x.user!.pubgAccountId as string);

  const recentByPlayer = await pubgProvider.getRecentMatches(platform, playerIds);

  // Intersection across all participants.
  let candidateIds: Set<string> | null = null;
  for (const ids of recentByPlayer.values()) {
    const set = new Set(ids);
    candidateIds = candidateIds === null ? set : intersect(candidateIds, set);
  }

  if (!candidateIds || candidateIds.size === 0) {
    await disputeAndRefund(roomId, 'No common match found across all participants recent match lists');
    return;
  }

  // If multiple candidates remain, prefer the one created after the room started.
  let chosenMatchId: string | null = null;
  for (const matchId of candidateIds) {
    const summary = await pubgProvider.getMatch(platform, matchId);
    if (!summary) continue;
    const createdAt = new Date(summary.createdAt);
    if (!room.startedAt || createdAt >= room.startedAt) {
      chosenMatchId = matchId;
      break;
    }
  }
  if (!chosenMatchId) {
    chosenMatchId = [...candidateIds][0] ?? null;
  }
  if (!chosenMatchId) {
    await disputeAndRefund(roomId, 'Could not resolve a candidate match');
    return;
  }

  const summary = await pubgProvider.getMatch(platform, chosenMatchId);
  if (!summary) {
    await disputeAndRefund(roomId, 'Match detail fetch failed');
    return;
  }

  const discrepancies: string[] = [];
  const participantsOut: { userId: string; pubgPlayerId: string; placement: number; kills: number; damage: number; timeSurvived: number }[] = [];

  for (const { entry, user } of linked) {
    const stats = summary.participants.find((p) => p.pubgPlayerId === user!.pubgAccountId);
    if (!stats) {
      discrepancies.push(`No stats found for user ${String(entry.userId)} in match ${chosenMatchId}`);
      continue;
    }
    participantsOut.push({
      userId: String(entry.userId),
      pubgPlayerId: stats.pubgPlayerId,
      placement: stats.placement,
      kills: stats.kills,
      damage: stats.damage,
      timeSurvived: stats.timeSurvived,
    });
    await roomEntryRepo.updateById(String(entry._id), {
      status: 'played',
      placement: stats.placement,
      kills: stats.kills,
    });
  }

  const verificationStatus = discrepancies.length === 0 ? 'verified' : participantsOut.length > 0 ? 'partial' : 'failed';

  await matchRepo.upsertForRoom(roomId, {
    roomId,
    pubgMatchId: chosenMatchId,
    fetchedAt: new Date(),
    participants: participantsOut,
    verificationStatus,
    discrepancies,
  } as never);

  if (verificationStatus === 'failed') {
    await disputeAndRefund(roomId, 'Match found but no participant stats could be matched');
    return;
  }

  await roomRepo.updateById(roomId, { status: 'settling', pubgMatchId: chosenMatchId, resultSource: 'pubg_api' });
  emitToRoom(roomId, 'match:verified', { roomId, matchId: chosenMatchId, verificationStatus });
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const v of a) if (b.has(v)) out.add(v);
  return out;
}

async function disputeAndRefund(roomId: string, reason: string): Promise<void> {
  await roomRepo.updateById(roomId, { status: 'disputed', disputeReason: reason });
  const entries = await roomEntryRepo.listForRoom(roomId);

  for (const entry of entries) {
    if (entry.status !== 'joined') continue;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = await walletRepo.findByUserId(String(entry.userId), session);
        if (!wallet) return;
        const feeMinor = decimal128ToMinorUnits(entry.entryFeeCharged);
        const newLocked = decimal128ToMinorUnits(wallet.lockedBalance) - feeMinor;
        const newCustodial = decimal128ToMinorUnits(wallet.custodialBalance) + feeMinor;

        await ledgerRepo.append(
          {
            userId: String(entry.userId),
            walletId: String(wallet._id),
            type: 'entry_refund',
            amount: minorUnitsToDecimalString(feeMinor),
            balanceAfter: minorUnitsToDecimalString(newCustodial),
            refType: 'room',
            refId: roomId,
            idempotencyKey: `dispute_refund:${roomId}:${String(entry.userId)}`,
          },
          session,
        );

        wallet.custodialBalance = minorUnitsToDecimal128(newCustodial);
        wallet.lockedBalance = minorUnitsToDecimal128(newLocked >= 0n ? newLocked : 0n);
        await wallet.save({ session });

        entry.status = 'refunded';
        await entry.save({ session });
      });
    } finally {
      await session.endSession();
    }
  }

  emitToRoom(roomId, 'room:disputed', { roomId, reason });
  logger.error({ roomId, reason }, 'Room moved to disputed and entries refunded');
}
