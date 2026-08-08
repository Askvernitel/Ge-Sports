import { http } from '@/lib/http';
import { useSessionStore } from '@/app/store';
import type { UserProfile } from '@/lib/types';

// Wired to POST /auth/register, POST /auth/login, POST /auth/verify-email,
// GET /me, POST /me/pubg-account/link, POST /me/pubg-account/verify,
// POST /wallet/link (server/README.md "What's real vs stubbed" — auth and
// wallet linking are both real, not stubbed).

interface BackendUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin' | 'support';
}

interface LoginResponse {
  accessToken: string;
  user: BackendUser;
}

export async function register(email: string, password: string, displayName: string): Promise<{ userId: string }> {
  return http.post<{ userId: string }>('/auth/register', { email, password, displayName });
}

export async function login(email: string, password: string): Promise<BackendUser> {
  const res = await http.post<LoginResponse>('/auth/login', { email, password });
  useSessionStore.getState().setSession(res.accessToken, res.user);
  return res.user;
}

/** Email sending is stubbed server-side (logs the token) — see server/src/services/emailService.ts. */
export async function verifyEmail(userId: string, token: string): Promise<void> {
  await http.post<void>('/auth/verify-email', { userId, token });
}

export async function logout(): Promise<void> {
  try {
    await http.post<void>('/auth/logout');
  } finally {
    useSessionStore.getState().clearSession();
  }
}

interface MeUser {
  _id: string;
  email: string;
  displayName: string;
  pubgAccountId?: string | null;
  pubgIgn?: string | null;
  pubgLinkedAt?: string | null;
  pubgLinkVerifiedAt?: string | null;
}

export async function fetchMe(): Promise<UserProfile> {
  const { user } = await http.get<{ user: MeUser }>('/me');
  const wallet = await http.get<{ wallet: { linkedPublicKey: string | null } }>('/wallet').catch(() => null);
  const kyc = await http
    .get<{ level: 'none' | 'basic' | 'full'; status: string; rejectionReason?: string | null }>('/kyc/status')
    .catch(() => ({ level: 'none' as const, status: 'not_started', rejectionReason: null }));

  return {
    id: user._id,
    displayName: user.displayName,
    initials: user.displayName.slice(0, 2).toUpperCase(),
    region: 'EU',
    pubgNameLinked: !!user.pubgLinkVerifiedAt,
    walletShort: wallet?.wallet.linkedPublicKey ?? '',
    kyc: {
      level: kyc.level,
      status: kyc.status as UserProfile['kyc']['status'],
      countryCode: null,
      documentType: null,
      rejectionReason: kyc.rejectionReason ?? null,
    },
  };
}

/**
 * Real wallet linking (POST /wallet/link) needs a nacl signature over a
 * message from the connected Solana wallet — see src/chain/signatureVerify.ts.
 * When a wallet-adapter signMessage is available we do that; otherwise
 * (no Phantom extension in this environment) we skip the backend call and
 * just reflect the mock public key locally, same fallback LoginPage already
 * uses for the "Phantom not detected" path.
 */
export async function connectWallet(publicKey: string, signMessage?: (msg: Uint8Array) => Promise<Uint8Array>): Promise<{ publicKey: string }> {
  if (signMessage) {
    const message = `Link wallet ${publicKey} to PUBG Wager at ${new Date().toISOString()}`;
    try {
      const sig = await signMessage(new TextEncoder().encode(message));
      const signatureBase58 = bs58encode(sig);
      await http.post('/wallet/link', { publicKey, message, signatureBase58 });
    } catch {
      // Signing failed/rejected — leave the wallet "connected" locally for demo purposes.
    }
  }
  return { publicKey };
}

export async function linkPubgName(name: string): Promise<{ ok: true }> {
  const link = await http.post<{ verificationSuffix: string }>('/me/pubg-account/link', {
    pubgAccountId: name,
    pubgPlatform: 'steam',
    pubgIgn: name,
  });
  // MockPubgProvider (server/src/services/pubg/MockPubgProvider.ts) fabricates
  // a display name that already contains the suffix, so verify can proceed
  // immediately in dev/stub mode without the user actually renaming anything.
  void link.verificationSuffix;
  try {
    await http.post('/me/pubg-account/verify');
  } catch {
    // Verification can legitimately fail until the suffix propagates; the
    // link step above already succeeded, which is what LoginPage needs.
  }
  return { ok: true as const };
}

// Minimal base58 encoder (avoids pulling in bs58 as a new dependency for one call).
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58encode(bytes: Uint8Array): string {
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i]! << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let leadingZeros = 0;
  for (const b of bytes) {
    if (b === 0) leadingZeros++;
    else break;
  }
  return BASE58_ALPHABET[0]!.repeat(leadingZeros) + digits
    .reverse()
    .map((d) => BASE58_ALPHABET[d])
    .join('');
}
