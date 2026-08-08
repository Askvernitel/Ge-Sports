import { http } from '@/lib/http';
import { decimalToNumber } from '@/lib/money';
import { useSessionStore } from '@/app/store';
import type { LedgerEntry, Limits, Wallet } from '@/lib/types';

// Wired to GET /wallet, GET /wallet/ledger, POST /wallet/withdrawals,
// POST /dev/faucet (server/README.md: dev faucet is real, gated by
// FEATURE_DEV_FAUCET + NODE_ENV!=production).
//
// POST /wallet/deposits/claim (real on-chain deposit verification) needs a
// signed devnet transaction signature, which this sandbox has no funded
// wallet to produce — see server/src/chain/txVerify.ts. Rather than fake a
// signature, the "Deposit tokens" button below calls the dev faucet
// instead, which is the backend's own supported path for getting testable
// balance without real Solana infra. requestWithdrawal is wired for real.

interface BackendWallet {
  userId: string;
  custodialBalance: { $numberDecimal: string };
  lockedBalance: { $numberDecimal: string };
  linkedPublicKey: string | null;
  lifetimeDeposited: { $numberDecimal: string };
  lifetimeWithdrawn: { $numberDecimal: string };
}

function mapWallet(w: BackendWallet): Wallet {
  return {
    userId: w.userId,
    custodialBalance: decimalToNumber(w.custodialBalance),
    lockedBalance: decimalToNumber(w.lockedBalance),
    // Backend has no on-chain balance reader endpoint (that lives client-side
    // via @solana/web3.js against the connected wallet) — approximate with
    // custodial+locked so the UI has a non-zero number to show.
    onChainBalance: decimalToNumber(w.custodialBalance) + decimalToNumber(w.lockedBalance),
    linkedPublicKey: w.linkedPublicKey,
    lifetimeDeposited: decimalToNumber(w.lifetimeDeposited),
    lifetimeWithdrawn: decimalToNumber(w.lifetimeWithdrawn),
  };
}

export async function fetchWallet(): Promise<Wallet> {
  const { wallet } = await http.get<{ wallet: BackendWallet }>('/wallet');
  return mapWallet(wallet);
}

interface BackendLedgerEntry {
  _id: string;
  type: LedgerEntry['type'];
  amount: { $numberDecimal: string };
  balanceAfter: { $numberDecimal: string };
  createdAt: string;
  refType?: LedgerEntry['refType'];
  refId?: string | null;
}

function statusForType(type: LedgerEntry['type']): LedgerEntry['status'] {
  if (type === 'entry_fee') return 'ESCROWED';
  if (type === 'payout') return 'PAID';
  if (type === 'withdrawal' || type === 'deposit') return 'CONFIRMED';
  return 'PENDING';
}

function describe(type: LedgerEntry['type']): string {
  switch (type) {
    case 'entry_fee':
      return 'Room entry fee';
    case 'entry_refund':
      return 'Entry fee refunded';
    case 'payout':
      return 'Match payout';
    case 'deposit':
      return 'Deposit';
    case 'withdrawal':
      return 'Withdrawal';
    case 'bonus':
      return 'Faucet credit';
    case 'rake':
      return 'Rake';
    default:
      return 'Adjustment';
  }
}

export async function fetchLedger(): Promise<LedgerEntry[]> {
  const { items } = await http.get<{ items: BackendLedgerEntry[] }>('/wallet/ledger');
  return items.map((e) => ({
    id: e._id,
    type: e.type,
    amount: decimalToNumber(e.amount),
    balanceAfter: decimalToNumber(e.balanceAfter),
    createdAt: new Date(e.createdAt).toLocaleString(),
    description: describe(e.type),
    status: statusForType(e.type),
    refType: e.refType,
    refId: e.refId ?? null,
  }));
}

export async function claimDeposit(amount: number): Promise<{ ok: true; wallet: Wallet }> {
  const { wallet } = await http.post<{ wallet: BackendWallet }>('/dev/faucet', { amount: String(amount) });
  return { ok: true as const, wallet: mapWallet(wallet) };
}

// --- Real on-chain deposit path (server/README.md's "custodial hybrid"
// model, spec section 4) — needs a configured treasury + SPL mint on the
// backend, which needs a funded devnet keypair; see
// server/scripts/setup-devnet-token.sh. Degrades to null when unconfigured
// so the UI can fall back to the faucet-only path rather than break. ---

export interface DepositInfo {
  treasuryPublicKey: string | null;
  mint: string | null;
}

export async function fetchDepositInfo(): Promise<DepositInfo> {
  return http.get<DepositInfo>('/wallet/deposit-info');
}

/** Dev-only: sends real on-chain GESPORTS tokens from the treasury to the
 * caller's own linked wallet, so there's something to actually deposit. */
export async function chainFaucet(amount: number): Promise<{ signature: string }> {
  return http.post<{ signature: string }>('/dev/chain-faucet', { amount: String(amount) });
}

/** Submits a signature for a deposit transaction the client already built,
 * signed, and sent on-chain — the backend verifies it independently
 * (mint/destination/sender/finalized) before crediting the ledger. */
export async function claimOnChainDeposit(signature: string): Promise<{ wallet: Wallet }> {
  await http.post('/wallet/deposits/claim', { signature });
  const wallet = await fetchWallet();
  return { wallet };
}

export async function requestWithdrawal(amount: number): Promise<{ ok: true; wallet: Wallet }> {
  const destinationPubkey = useSessionStore.getState().publicKey ?? '';
  await http.post('/wallet/withdrawals', { amount: String(amount), destinationPubkey });
  const wallet = await fetchWallet();
  return { ok: true as const, wallet };
}

// --- Responsible-gaming limits (spec section 10) -----------------------
// The backend only implements self-exclusion (POST /me/self-exclude); a
// per-day deposit cap and session-reminder toggle have no endpoint, so
// those two stay local/mock here — flagged rather than silently faked.
let MOCK_LIMITS: Limits = {
  depositLimitPerDay: 500,
  sessionReminderEnabled: true,
  sessionReminderMinutes: 60,
  selfExclusionActive: false,
  selfExclusionUntil: null,
};

export async function fetchLimits(): Promise<Limits> {
  return MOCK_LIMITS;
}

export async function updateLimits(patch: Partial<Limits>): Promise<Limits> {
  MOCK_LIMITS = { ...MOCK_LIMITS, ...patch };
  return MOCK_LIMITS;
}

export async function setSelfExclusion(days: number): Promise<Limits> {
  const untilDate = new Date(Date.now() + days * 86_400_000).toISOString();
  await http.post('/me/self-exclude', { untilDate });
  MOCK_LIMITS = { ...MOCK_LIMITS, selfExclusionActive: true, selfExclusionUntil: untilDate };
  return MOCK_LIMITS;
}
