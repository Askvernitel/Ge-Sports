import { http } from '@/lib/http';
import { decimalToNumber } from '@/lib/money';
import { computeRake, computeDistributable } from '@/lib/money';
import type { MatchResult, MatchResultRow } from '@/lib/types';

// Wired to GET /matches/:id (server/src/controllers/matchController.ts).
// The Match document only stores roomId + per-participant placement/kills —
// it doesn't carry payout amounts (those are written as LedgerEntry rows per
// user, and there's no endpoint that lists another user's ledger). So
// payouts here are recomputed client-side using the exact same weighting
// rules as settlementService.ts (winner_take_all / top3 3:2:1 /
// placement_points fieldSize+1-placement) rather than fetched — same
// arithmetic, just run in the browser instead of trusted from the server.
// Player names aren't resolvable from participants' userId (no public user
// lookup endpoint), so rows show a short id in place of a display name.

interface BackendParticipant {
  userId: string;
  placement: number | null;
  kills: number | null;
}

interface BackendMatch {
  _id: string;
  roomId: string;
  participants: BackendParticipant[];
  verificationStatus: 'verified' | 'partial' | 'failed';
}

interface BackendRoom {
  code: string;
  config: { mode: MatchResult['mode']; map: MatchResult['map']; payoutStructure: 'winner_take_all' | 'top3' | 'placement_points' };
  prizePool: { $numberDecimal: string };
  rakeBps: number;
  settledAt: string | null;
}

function computeRows(participants: BackendParticipant[], payoutStructure: string, distributed: number): MatchResultRow[] {
  const placed = participants
    .filter((p) => p.placement != null)
    .sort((a, b) => (a.placement as number) - (b.placement as number));

  let weights: { userId: string; weight: number }[];
  if (payoutStructure === 'winner_take_all') {
    weights = placed.length > 0 ? [{ userId: placed[0]!.userId, weight: 1 }] : [];
  } else if (payoutStructure === 'top3') {
    const top3 = placed.filter((p) => (p.placement as number) <= 3).slice(0, 3);
    weights = top3.map((p, idx) => ({ userId: p.userId, weight: 3 - idx }));
  } else {
    const fieldSize = placed.length;
    weights = placed.map((p) => ({ userId: p.userId, weight: Math.max(1, fieldSize + 1 - (p.placement as number)) }));
  }
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0) || 1;
  const payoutByUser = new Map(weights.map((w) => [w.userId, Math.round((distributed * w.weight) / totalWeight)]));

  return placed.map((p) => ({
    rank: p.placement as number,
    player: p.userId.slice(-6).toUpperCase(),
    userId: p.userId,
    kills: p.kills ?? 0,
    points: p.kills ?? 0,
    payout: payoutByUser.get(p.userId) ?? 0,
  }));
}

export async function fetchMatchResult(matchId: string): Promise<MatchResult> {
  const { match } = await http.get<{ match: BackendMatch }>(`/matches/${matchId}`);
  const { room } = await http.get<{ room: BackendRoom }>(`/rooms/${match.roomId}`);

  const pool = decimalToNumber(room.prizePool);
  const rakeAmount = computeRake(pool, room.rakeBps);
  const distributed = computeDistributable(pool, room.rakeBps);

  return {
    roomCode: room.code,
    mode: room.config.mode,
    map: room.config.map,
    settledAt: room.settledAt ? new Date(room.settledAt).toLocaleTimeString() : '—',
    pool,
    rakeBps: room.rakeBps,
    rakeAmount,
    distributed,
    rows: computeRows(match.participants, room.config.payoutStructure, distributed),
  };
}
