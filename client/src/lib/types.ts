// Shapes mirror pubg-wager-platform-spec.md section 3 (data models),
// trimmed to what the frontend needs to render + drive UI state.
// Money fields are integer "minor units" of the platform token (whole test-token
// units here, since spec doesn't define decimals for display — see lib/money.ts).

export type RoomStatus =
  | 'open'
  | 'locked'
  | 'in_progress'
  | 'awaiting_results'
  | 'settling'
  | 'settled'
  | 'cancelled'
  | 'disputed';

export type RoomMode = 'solo' | 'duo' | 'squad';
export type RoomMap = 'erangel' | 'miramar' | 'sanhok' | 'vikendi' | 'any';
export type Region = 'EU' | 'NA' | 'SA' | 'AS' | 'OCE';
export type PayoutStructure = 'winner_take_all' | 'top3' | 'placement_points';

export interface RoomConfig {
  mode: RoomMode;
  perspective: 'tpp' | 'fpp';
  map: RoomMap;
  region: Region;
  entryFee: number;
  maxPlayers: number;
  minPlayers: number;
  payoutStructure: PayoutStructure;
  skillBand: { minRating: number; maxRating: number } | null;
  isPrivate: boolean;
}

export interface Room {
  id: string;
  code: string;
  createdBy: string;
  status: RoomStatus;
  config: RoomConfig;
  prizePool: number;
  rakeBps: number;
  scheduledStartAt: string;
  lockAt: string; // ISO timestamp — countdowns tick client-side from this
  startedAt: string | null;
  settledAt: string | null;
  seatsFilled: number;
  joinedByMe: boolean;
  isLive: boolean;
  alivePlayers?: number;
}

export interface RoomEntry {
  roomId: string;
  userId: string;
  joinedAt: string;
  entryFeeCharged: number;
  status: 'joined' | 'refunded' | 'no_show' | 'played' | 'disqualified';
  placement?: number;
  kills?: number;
  pointsAwarded?: number;
  payoutAmount?: number;
}

export interface Participant {
  userId: string;
  name: string;
  status: 'JOINED' | 'ESCROWED' | 'ALIVE' | 'ELIMINATED';
  profileUrl: string;
}

export interface Wallet {
  userId: string;
  custodialBalance: number; // "available"
  lockedBalance: number; // "locked in rooms"
  onChainBalance: number; // read from the connected wallet, not custody
  linkedPublicKey: string | null;
  lifetimeDeposited: number;
  lifetimeWithdrawn: number;
}

export type LedgerEntryType =
  | 'deposit'
  | 'withdrawal'
  | 'entry_fee'
  | 'entry_refund'
  | 'payout'
  | 'rake'
  | 'adjustment'
  | 'bonus';

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amount: number; // signed
  balanceAfter: number;
  createdAt: string;
  description: string;
  status: 'ESCROWED' | 'PAID' | 'CONFIRMED' | 'PENDING';
  /** 'room' | 'match' | 'onchain_tx' | 'manual' — which entity refId points at, when set. */
  refType?: 'room' | 'match' | 'onchain_tx' | 'manual';
  refId?: string | null;
}

export type KycLevel = 'none' | 'basic' | 'full';
export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired';

export interface KycRecord {
  level: KycLevel;
  status: KycStatus;
  countryCode: string | null;
  documentType: string | null;
  rejectionReason: string | null;
}

export interface MatchResultRow {
  rank: number;
  player: string;
  kills: number;
  points: number;
  payout: number;
  userId?: string;
}

export interface MatchResult {
  roomCode: string;
  mode: RoomMode;
  map: RoomMap;
  settledAt: string;
  pool: number;
  rakeBps: number;
  rakeAmount: number;
  distributed: number;
  rows: MatchResultRow[];
}

export interface Limits {
  depositLimitPerDay: number;
  sessionReminderEnabled: boolean;
  sessionReminderMinutes: number;
  selfExclusionActive: boolean;
  selfExclusionUntil: string | null;
}

export interface UserProfile {
  id: string;
  displayName: string;
  initials: string;
  region: Region;
  pubgNameLinked: boolean;
  walletShort: string;
  kyc: KycRecord;
}

export interface RoomFilters {
  region: Region | null;
  modes: RoomMode[];
  feeMin: number;
  feeMax: number;
  openOnly: boolean;
  joinedOnly: boolean;
}
