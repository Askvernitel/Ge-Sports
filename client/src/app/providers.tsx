import { useEffect, useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useSessionStore } from '@/app/store';
import { http, refreshAccessToken } from '@/lib/http';

/**
 * On a hard reload the access token (deliberately memory-only, never
 * localStorage'd — see app/store.ts) is gone, but the httpOnly refresh
 * cookie from a previous login may still be valid. Silently trade it for a
 * fresh access token + user profile so the session survives a refresh
 * instead of forcing a re-login every time.
 *
 * Goes through the *same* deduped refreshAccessToken as lib/http.ts's 401
 * retry path rather than firing its own fetch — refresh tokens rotate on
 * every use, so two independent concurrent refresh calls (this raced with
 * React 19 StrictMode's double effect-invocation in dev) would have the
 * second treated as replaying an already-rotated token, which the backend
 * correctly responds to by revoking the whole token family.
 */
function useSessionBootstrap() {
  const setSession = useSessionStore((s) => s.setSession);
  const setBootstrapped = useSessionStore((s) => s.setBootstrapped);
  useEffect(() => {
    (async () => {
      try {
        const accessToken = await refreshAccessToken();
        if (!accessToken) return;
        const { user } = await http.get<{ user: { _id: string; email: string; displayName: string; role: 'user' | 'admin' | 'support' } }>('/me');
        setSession(accessToken, { id: user._id, email: user.email, displayName: user.displayName, role: user.role });
      } catch {
        // No valid refresh cookie yet — stays logged out until the user signs in.
      } finally {
        setBootstrapped();
      }
    })();
  }, [setSession, setBootstrapped]);
}

// Solana devnet only per spec — never point this at mainnet.
const SOLANA_NETWORK = 'devnet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl(SOLANA_NETWORK), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  useSessionBootstrap();

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect={false}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
