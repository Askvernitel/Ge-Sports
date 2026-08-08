import { create } from 'zustand';

// Session / wallet-connection state (Zustand, per spec section 1). Balances
// and room data are server state and live in TanStack Query instead — this
// store only holds client-local session facts, including the in-memory JWT
// access token (never persisted to localStorage; refresh is handled via the
// httpOnly cookie the backend sets on login).
interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin' | 'support';
}

interface SessionState {
  walletConnected: boolean;
  publicKey: string | null;
  pubgName: string | null;
  pubgNameLinked: boolean;
  displayName: string;
  initials: string;

  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the initial silent-refresh (httpOnly cookie -> access token) attempt finishes. */
  isBootstrapping: boolean;
  setBootstrapped: () => void;

  connectWallet: (publicKey: string) => void;
  disconnectWallet: () => void;
  setPubgName: (name: string) => void;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export const useSessionStore = create<SessionState>((set) => ({
  walletConnected: false,
  publicKey: null,
  pubgName: null,
  pubgNameLinked: false,
  displayName: 'Guest',
  initials: '?',

  accessToken: null,
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  setBootstrapped: () => set({ isBootstrapping: false }),

  connectWallet: (publicKey) => set({ walletConnected: true, publicKey }),
  disconnectWallet: () => set({ walletConnected: false, publicKey: null }),
  setPubgName: (name) => set({ pubgName: name, pubgNameLinked: name.length > 0 }),
  setSession: (accessToken, user) =>
    set({
      accessToken,
      user,
      isAuthenticated: true,
      displayName: user.displayName,
      initials: initials(user.displayName),
    }),
  clearSession: () =>
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      displayName: 'Guest',
      initials: '?',
      walletConnected: false,
      publicKey: null,
    }),
}));

/** Non-hook accessor for use outside React (e.g. lib/http.ts). */
export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}
