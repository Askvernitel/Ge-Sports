import { http } from '@/lib/http';
import { decimalToNumber } from '@/lib/money';
import type { Region, Room, RoomFilters, Participant } from '@/lib/types';

// Wired to GET /rooms, GET /rooms/:id, POST /rooms, POST /rooms/:id/join,
// POST /rooms/:id/leave, POST /rooms/:id/start (all real — server/README.md
// "Room escrow (join/leave/start)" row).
//
// Two fields the frontend `Room` type expects have no direct backend
// counterpart, so they're derived rather than faked:
//  - seatsFilled: the Room document doesn't carry a seat count, but
//    prizePool accrues by exactly one entryFee per join (see
//    roomService.join), so prizePool / entryFee recovers it exactly.
//  - joinedByMe: there's no "my room entries" listing endpoint, so we track
//    rooms this session has joined/left locally (updated by joinRoom/
//    leaveRoom below) and overlay it onto whatever the API returns.
//
// fetchRoomParticipants is wired to GET /rooms/:id/entries, which joins
// RoomEntry with the user's displayName server-side (see roomService.listEntries).
// fetchMyRooms is wired to GET /rooms/mine, which returns rooms the caller has
// an active ('joined') RoomEntry in (see roomService.listMine).

export const LOCK_WINDOW_MS = 30 * 60_000;

const joinedRoomIds = new Set<string>();

interface BackendRoomConfig {
  mode: Room['config']['mode'];
  perspective: Room['config']['perspective'];
  map: Room['config']['map'];
  region: string;
  entryFee: { $numberDecimal: string };
  maxPlayers: number;
  minPlayers: number;
  payoutStructure: Room['config']['payoutStructure'];
  skillBand: { minRating: number; maxRating: number } | null;
  isPrivate: boolean;
}

interface BackendRoom {
  _id: string;
  code: string;
  createdBy: string;
  status: Room['status'];
  config: BackendRoomConfig;
  prizePool: { $numberDecimal: string };
  rakeBps: number;
  scheduledStartAt: string | null;
  lockAt: string | null;
  startedAt: string | null;
  settledAt: string | null;
}

function mapRoom(r: BackendRoom): Room {
  const entryFee = decimalToNumber(r.config.entryFee);
  const prizePool = decimalToNumber(r.prizePool);
  const seatsFilled = entryFee > 0 ? Math.round(prizePool / entryFee) : 0;
  const lockAt = r.lockAt ?? r.scheduledStartAt ?? new Date(Date.now() + LOCK_WINDOW_MS).toISOString();

  return {
    id: r._id,
    code: r.code,
    createdBy: r.createdBy,
    status: r.status,
    config: {
      mode: r.config.mode,
      perspective: r.config.perspective,
      map: r.config.map,
      region: r.config.region as Region,
      entryFee,
      maxPlayers: r.config.maxPlayers,
      minPlayers: r.config.minPlayers,
      payoutStructure: r.config.payoutStructure,
      skillBand: r.config.skillBand,
      isPrivate: r.config.isPrivate,
    },
    prizePool,
    rakeBps: r.rakeBps,
    scheduledStartAt: r.scheduledStartAt ?? lockAt,
    lockAt,
    startedAt: r.startedAt,
    settledAt: r.settledAt,
    seatsFilled,
    joinedByMe: joinedRoomIds.has(r._id),
    isLive: r.status === 'in_progress',
    alivePlayers: r.status === 'in_progress' ? Math.max(0, seatsFilled) : undefined,
  };
}

export async function fetchRooms(filters: Partial<RoomFilters> = {}): Promise<Room[]> {
  // Region is intentionally not sent — the UI no longer divides rooms by
  // region, though the backend and Room model still carry config.region.
  const params = new URLSearchParams();
  if (filters.modes && filters.modes.length === 1) params.set('mode', filters.modes[0]!);
  if (typeof filters.feeMin === 'number') params.set('minFee', String(filters.feeMin));
  if (typeof filters.feeMax === 'number') params.set('maxFee', String(filters.feeMax));
  if (filters.openOnly) {
    params.set('status', 'open');
    params.set('hasSpace', '1');
  }
  params.set('limit', '50');

  const { items } = await http.get<{ items: BackendRoom[] }>(`/rooms?${params.toString()}`);
  let rooms = items.map(mapRoom);
  if (filters.modes && filters.modes.length > 1) rooms = rooms.filter((r) => filters.modes!.includes(r.config.mode));
  if (filters.joinedOnly) rooms = rooms.filter((r) => r.joinedByMe);
  return rooms;
}

export async function fetchRoom(id: string): Promise<Room | undefined> {
  try {
    const { room } = await http.get<{ room: BackendRoom }>(`/rooms/${id}`);
    return mapRoom(room);
  } catch {
    return undefined;
  }
}

interface BackendParticipant {
  userId: string;
  name: string;
  pubgIgn: string | null;
  status: Participant['status'];
}

export async function fetchRoomParticipants(roomId: string): Promise<Participant[]> {
  const { items } = await http.get<{ items: BackendParticipant[] }>(`/rooms/${roomId}/entries`);
  return items.map((p) => ({
    userId: p.userId,
    name: p.name,
    status: p.status,
    profileUrl: p.pubgIgn ? `https://pubg.op.gg/user/${encodeURIComponent(p.pubgIgn)}` : '#',
  }));
}

export async function fetchLiveRooms(): Promise<Room[]> {
  const { items } = await http.get<{ items: BackendRoom[] }>('/rooms?status=in_progress&limit=20');
  return items.map(mapRoom);
}

export async function joinRoom(roomId: string, password?: string): Promise<{ ok: true }> {
  await http.post(`/rooms/${roomId}/join`, password ? { password } : {});
  joinedRoomIds.add(roomId);
  return { ok: true as const };
}

export async function leaveRoom(roomId: string): Promise<{ ok: true }> {
  await http.post(`/rooms/${roomId}/leave`);
  joinedRoomIds.delete(roomId);
  return { ok: true as const };
}

export async function startRoom(roomId: string): Promise<Room> {
  const { room } = await http.post<{ room: BackendRoom }>(`/rooms/${roomId}/start`);
  return mapRoom(room);
}

export interface CreateRoomInput {
  mode: Room['config']['mode'];
  perspective: Room['config']['perspective'];
  map: Room['config']['map'];
  region: Region;
  entryFee: number;
  maxPlayers: number;
  minPlayers: number;
  payoutStructure: Room['config']['payoutStructure'];
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const { room } = await http.post<{ room: BackendRoom }>('/rooms', {
    ...input,
    entryFee: String(input.entryFee),
  });
  return mapRoom(room);
}

export const MODES: Room['config']['mode'][] = ['solo', 'duo', 'squad'];

/** Rooms the current user has an active entry in — used on the Profile screen. */
export async function fetchMyRooms(): Promise<Room[]> {
  const { items } = await http.get<{ items: BackendRoom[] }>('/rooms/mine');
  return items.map((r) => {
    const room = mapRoom(r);
    joinedRoomIds.add(r._id);
    return { ...room, joinedByMe: true };
  });
}
