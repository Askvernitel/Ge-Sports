import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { computeRake, decimal128ToMinorUnits, minorUnitsToDecimal128, minorUnitsToDecimalString, splitByWeights, sumPayouts, type Payout } from '../utils/money.js';
import { roomRepo } from '../repositories/roomRepo.js';
import { roomEntryRepo } from '../repositories/roomEntryRepo.js';
import { walletRepo } from '../repositories/walletRepo.js';
import { ledgerRepo } from '../repositories/ledgerRepo.js';
import type { RoomEntryDoc } from '../models/RoomEntry.js';
import { emitToRoom } from '../realtime/socket.js';

export const HOUSE_USER_ID = '000000000000000000000000';
export const HOUSE_WALLET_ID = '000000000000000000000000';

export type PayoutStructure = 'winner_take_all' | 'top3' | 'placement_points';

export interface SettlementEntryInput {
  entryId: string;
  userId: string;
  placement: number | null;
}

/**
 * Pure function (no DB) computing per-user payouts in minor units from a
 * prize pool, rake, payout structure, and ranked placements. Kept separate
 * from the DB-touching settleRoom() below so it's trivially unit-testable.
 */
export function computePayouts(params: {
  prizePoolMinor: bigint;
  rakeBps: number;
  payoutStructure: PayoutStructure;
  entries: SettlementEntryInput[];
}): { rake: bigint; distributable: bigint; payouts: Payout[] } {
  const { prizePoolMinor, rakeBps, payoutStructure, entries } = params;
  const rake = computeRake(prizePoolMinor, rakeBps);
  const distributable = prizePoolMinor - rake;

  const placed = entries
    .filter((e) => e.placement !== null && e.placement !== undefined)
    .sort((a, b) => (a.placement as number) - (b.placement as number));

  let payouts: Payout[];

  if (placed.length === 0) {
    // No verified placements: nothing distributable, but rake must still
    // account for the whole pool minus zero payouts - this path should be
    // prevented upstream (disputed rooms never reach settlement), but guard
    // it anyway so the invariant still holds if it ever does.
    payouts = [];
  } else if (payoutStructure === 'winner_take_all') {
    const winner = placed[0];
    payouts = winner ? [{ key: winner.userId, amount: distributable }] : [];
  } else if (payoutStructure === 'top3') {
    const top3 = placed.filter((e) => (e.placement as number) <= 3).slice(0, 3);
    // Standard 3-way weighting: 1st gets 3 shares, 2nd gets 2, 3rd gets 1.
    const weights = top3.map((e, idx) => ({ key: e.userId, weight: 3 - idx }));
    payouts = splitByWeights(distributable, weights);
  } else if (payoutStructure === 'placement_points') {
    // Points model: everyone who placed earns weight proportional to
    // (fieldSize + 1 - placement), so 1st place earns the most and last
    // place still earns a nonzero share. Deterministic and auditable.
    const fieldSize = placed.length;
    const weights = placed.map((e) => ({
      key: e.userId,
      weight: Math.max(1, fieldSize + 1 - (e.placement as number)),
    }));
    payouts = splitByWeights(distributable, weights);
  } else {
    throw new AppError('VALIDATION_ERROR', `Unknown payout structure: ${payoutStructure as string}`);
  }

  const totalPayout = sumPayouts(payouts);
  if (totalPayout + rake !== prizePoolMinor) {
    throw new AppError(
      'SETTLEMENT_INVARIANT_VIOLATION',
      `Settlement invariant violated: payouts(${totalPayout}) + rake(${rake}) !== prizePool(${prizePoolMinor})`,
    );
  }

  return { rake, distributable, payouts };
}

/** Merge Payout[] (keyed by userId, possibly with duplicate userIds across weight rows) into one row per user. */
function mergePayoutsByUser(payouts: Payout[]): Map<string, bigint> {
  const map = new Map<string, bigint>();
  for (const p of payouts) {
    map.set(p.key, (map.get(p.key) ?? 0n) + p.amount);
  }
  return map;
}

/**
 * Settlement engine (spec section 6). Single idempotent job keyed on roomId,
 * runs inside a Mongo transaction. Re-running on an already-settled room is
 * a no-op.
 */
export async function settleRoom(roomId: string): Promise<{ noop: boolean }> {
  const session = await mongoose.startSession();
  try {
    let noop = false;
    await session.withTransaction(async () => {
      const room = await roomRepo.findById(roomId, session);
      if (!room) throw new AppError('NOT_FOUND', 'Room not found');

      if (room.status === 'settled') {
        noop = true;
        return;
      }
      if (room.status !== 'awaiting_results' && room.status !== 'settling') {
        throw new AppError('CONFLICT', `Room is ${room.status}, not ready to settle`);
      }

      const entries = await roomEntryRepo.listForRoom(roomId, session);
      const playedEntries = entries.filter((e) => e.status === 'played' || e.status === 'joined');

      const prizePoolMinor = decimal128ToMinorUnits(room.prizePool);
      const { rake, payouts } = computePayouts({
        prizePoolMinor,
        rakeBps: room.rakeBps,
        payoutStructure: room.config.payoutStructure as PayoutStructure,
        entries: playedEntries.map((e) => ({ entryId: String(e._id), userId: String(e.userId), placement: e.placement ?? null })),
      });

      const payoutByUser = mergePayoutsByUser(payouts);

      // Rake -> house ledger row (house wallet is a well-known sentinel id; a
      // real deployment would back this with an actual house User/Wallet).
      if (rake > 0n) {
        await ledgerRepo.append(
          {
            userId: HOUSE_USER_ID,
            walletId: HOUSE_WALLET_ID,
            type: 'rake',
            amount: minorUnitsToDecimalString(rake),
            balanceAfter: minorUnitsToDecimalString(rake),
            refType: 'room',
            refId: roomId,
            idempotencyKey: `rake:${roomId}`,
          },
          session,
        );
      }

      for (const entry of entries) {
        // Entries already refunded (via leave()) had their lockedBalance
        // released at refund time - releasing again would double-count.
        if (entry.status === 'refunded' || entry.status === 'no_show') continue;
        await releaseEntryLock(entry, roomId, payoutByUser.get(String(entry.userId)) ?? 0n, session);
      }

      room.status = 'settled';
      room.settledAt = new Date();
      await room.save({ session });
      noop = false;
    });

    if (!noop) emitToRoom(roomId, 'room:settled', { roomId });
    return { noop };
  } finally {
    await session.endSession();
  }
}

async function releaseEntryLock(entry: RoomEntryDoc, roomId: string, payoutMinor: bigint, session: ClientSession) {
  const resolvedWallet = await walletRepo.findByUserId(String(entry.userId), session);
  if (!resolvedWallet) return; // defensive - should never happen since join() requires a wallet

  const feeMinor = decimal128ToMinorUnits(entry.entryFeeCharged);
  const currentLocked = decimal128ToMinorUnits(resolvedWallet.lockedBalance);
  const newLocked = currentLocked - feeMinor >= 0n ? currentLocked - feeMinor : 0n;

  const currentCustodial = decimal128ToMinorUnits(resolvedWallet.custodialBalance);
  const newCustodial = currentCustodial + payoutMinor;

  if (payoutMinor > 0n) {
    await ledgerRepo.append(
      {
        userId: String(entry.userId),
        walletId: String(resolvedWallet._id),
        type: 'payout',
        amount: minorUnitsToDecimalString(payoutMinor),
        balanceAfter: minorUnitsToDecimalString(newCustodial),
        refType: 'room',
        refId: roomId,
        idempotencyKey: `payout:${roomId}:${String(entry.userId)}`,
      },
      session,
    );
  }

  resolvedWallet.lockedBalance = minorUnitsToDecimal128(newLocked);
  resolvedWallet.custodialBalance = minorUnitsToDecimal128(newCustodial);
  await resolvedWallet.save({ session });

  entry.status = payoutMinor > 0n ? 'played' : entry.status === 'joined' ? 'played' : entry.status;
  entry.payoutAmount = minorUnitsToDecimal128(payoutMinor);
  await entry.save({ session });
}
