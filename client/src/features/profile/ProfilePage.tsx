import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletNotReadyError } from '@solana/wallet-adapter-base';
import { useSessionStore } from '@/app/store';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { fetchLedger } from '@/features/wallet/api';
import { fetchMyRooms } from '@/features/rooms/api';
import { linkPubgName } from '@/features/auth/api';
import { fetchKycStatus } from '@/features/kyc/api';
import { mapImageFor } from '@/lib/mapAssets';
import { formatTokens, formatSigned } from '@/lib/money';
import { tokens } from '@/lib/tokens';
import { Skeleton } from '@/components/Skeleton';

const ID_VERIFICATION_LABEL: Record<string, string> = {
  not_started: 'Start ID verification',
  pending: 'ID verification pending',
  approved: 'ID verified',
  rejected: 'Retry ID verification',
};

export function ProfilePage() {
  const { displayName, initials, publicKey, walletConnected, connectWallet, pubgName, pubgNameLinked, setPubgName } =
    useSessionStore();
  const { data: wallet, isLoading: walletLoading } = useWalletBalance();
  const animatedOnChain = useAnimatedNumber(wallet?.onChainBalance ?? 0);
  const animatedAvailable = useAnimatedNumber(wallet?.custodialBalance ?? 0);
  const animatedLocked = useAnimatedNumber(wallet?.lockedBalance ?? 0);
  const { data: ledger, isLoading: ledgerLoading } = useQuery({ queryKey: ['ledger'], queryFn: fetchLedger });
  const { data: myRooms, isLoading: roomsLoading } = useQuery({ queryKey: ['rooms', 'mine'], queryFn: fetchMyRooms });
  const { data: idVerification } = useQuery({ queryKey: ['kyc', 'status'], queryFn: fetchKycStatus });

  const solanaWallet = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(pubgName ?? '');
  const [linking, setLinking] = useState(false);

  // wallet-adapter-react's `select()` updates `wallet.wallet` (the chosen
  // adapter) through React state, so calling `connect()` in the same
  // synchronous handler right after `select()` still sees the OLD adapter
  // reference from this render's closure and throws — which the previous
  // implementation caught and silently swapped in a fake pubkey, making
  // Phantom look broken even when it was installed and working fine. The
  // fix: select, then let this effect fire `connect()` once the adapter
  // context has actually updated to the newly selected one.
  const pendingConnect = useRef(false);
  useEffect(() => {
    if (!pendingConnect.current || !solanaWallet.wallet) return;
    pendingConnect.current = false;
    solanaWallet
      .connect()
      .then(() => {
        if (solanaWallet.publicKey) connectWallet(solanaWallet.publicKey.toBase58());
      })
      .catch((err: unknown) => {
        if (err instanceof WalletNotReadyError) {
          setConnectError('Phantom extension not found. Install it from phantom.app, then try again.');
        } else {
          setConnectError(err instanceof Error ? err.message : 'Could not connect to Phantom.');
        }
      })
      .finally(() => setConnecting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solanaWallet.wallet]);

  function handleConnectWallet() {
    setConnectError(null);
    setConnecting(true);
    const phantom = solanaWallet.wallets.find((w) => w.adapter.name.toLowerCase().includes('phantom'));
    if (!phantom) {
      setConnecting(false);
      setConnectError('Phantom extension not found. Install it from phantom.app, then try again.');
      return;
    }
    pendingConnect.current = true;
    solanaWallet.select(phantom.adapter.name);
  }

  async function handleLinkPubgName() {
    if (!nameInput.trim()) return;
    setLinking(true);
    try {
      await linkPubgName(nameInput.trim());
      setPubgName(nameInput.trim());
    } finally {
      setLinking(false);
    }
  }

  return (
    <div>
      {/* Identity header */}
      <div className="flex flex-wrap items-end justify-between gap-6 px-10 pt-12 pb-8 border-b border-lichen">
        <div className="flex items-center gap-6">
          <div className="w-[72px] h-[72px] bg-zone text-ground font-display font-black text-3xl flex items-center justify-center">
            {initials}
          </div>
          <div>
            <div className="font-display font-black text-5xl tracking-[1px] uppercase leading-none">
              {displayName}
            </div>
            <div className="font-mono text-sm text-lichen mt-2">
              {pubgNameLinked ? 'PUBG NAME LINKED' : 'PUBG NAME NOT LINKED'} · {publicKey ?? 'WALLET NOT CONNECTED'}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            to="/wallet"
            className="bg-zone text-ground text-sm font-semibold no-underline px-[22px] py-3 transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.98]"
          >
            Deposit / withdraw
          </Link>
          <Link
            to="/verify"
            className="text-sm font-semibold no-underline px-[22px] py-3 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-px active:scale-[0.98]"
            style={{
              border: `1px solid ${idVerification?.status === 'approved' ? tokens.zone : idVerification?.status === 'rejected' ? tokens.flare : tokens.lichen}`,
              color: idVerification?.status === 'approved' ? tokens.zone : idVerification?.status === 'rejected' ? tokens.flare : tokens.bone,
            }}
          >
            {ID_VERIFICATION_LABEL[idVerification?.status ?? 'not_started']}
          </Link>
        </div>
      </div>

      {/* Wallet connect + PUBG name link — required before joining a room,
          kept off the sign-up/sign-in flow on purpose. */}
      <div className="flex flex-wrap gap-6 px-10 pt-8">
        <div className="border border-lichen bg-panel p-6" style={{ flex: '1 1 320px' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-display font-bold text-md tracking-[1px] uppercase">Wallet</div>
              <div className="font-mono text-sm text-lichen mt-1.5">Phantom · Solana devnet</div>
            </div>
            <button
              onClick={handleConnectWallet}
              disabled={connecting || walletConnected}
              className="bg-zone border-none text-ground font-sans text-sm font-semibold px-5 py-3 cursor-pointer disabled:opacity-60"
            >
              {walletConnected ? 'Connected' : connecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {connectError && <div className="text-xs text-lichen mt-3 leading-[1.5]">{connectError}</div>}
        </div>

        <div className="border border-lichen bg-panel p-6" style={{ flex: '1 1 320px' }}>
          <div className="font-display font-bold text-md tracking-[1px] uppercase mb-3.5">PUBG name</div>
          <div className="flex gap-2.5">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="In-game name"
              className="flex-1 bg-ground border border-lichen text-bone font-mono text-[15px] p-3 box-border"
            />
            <button
              onClick={handleLinkPubgName}
              disabled={linking || !nameInput.trim()}
              className="bg-zone border-none text-ground font-sans text-sm font-semibold px-5 py-3 cursor-pointer disabled:opacity-60"
            >
              {linking ? 'Linking…' : pubgNameLinked ? 'Update' : 'Link'}
            </button>
          </div>
          <div className="text-sm text-lichen mt-3 leading-[1.5]">
            Case sensitive. Match results are read against this name.
          </div>
        </div>
      </div>

      {/* Three distinct balance cells */}
      <div
        className="grid gap-px bg-lichen m-10"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        <div className="bg-panel p-7">
          <div className="font-mono text-xs tracking-[1px] text-lichen">ON-CHAIN WALLET</div>
          {walletLoading ? (
            <Skeleton className="h-[52px] w-2/3 mt-3.5" />
          ) : (
            <div className="font-mono text-5xl tabular-nums mt-3.5">{wallet ? formatTokens(animatedOnChain) : '—'}</div>
          )}
          <div className="text-sm text-lichen mt-3 leading-[1.5]">
            Everything held by your connected Phantom wallet on Solana devnet.
          </div>
        </div>
        <div className="bg-panel p-7">
          <div className="font-mono text-xs tracking-[1px] text-lichen">AVAILABLE</div>
          {walletLoading ? (
            <Skeleton className="h-[52px] w-2/3 mt-3.5" />
          ) : (
            <div className="font-mono text-5xl tabular-nums mt-3.5">{wallet ? formatTokens(animatedAvailable) : '—'}</div>
          )}
          <div className="text-sm text-lichen mt-3 leading-[1.5]">Free to enter a room or withdraw.</div>
        </div>
        <div className="bg-panel p-7" style={{ borderTop: `2px solid ${tokens.zone}` }}>
          <div className="font-mono text-xs tracking-[1px] text-zone">LOCKED IN ROOMS</div>
          {walletLoading ? (
            <Skeleton className="h-[52px] w-2/3 mt-3.5" />
          ) : (
            <div className="font-mono text-5xl tabular-nums mt-3.5 text-zone">{wallet ? formatTokens(animatedLocked) : '—'}</div>
          )}
          <div className="text-sm text-lichen mt-3 leading-[1.5]">
            {(() => {
              const openCount = (myRooms ?? []).filter((r) => r.status === 'open' || r.status === 'locked' || r.isLive).length;
              const noun = openCount === 1 ? 'room' : 'rooms';
              return openCount > 0
                ? `Held as entry fees in ${openCount} open ${noun}. Returns to available when each room settles.`
                : 'Returns to available when each room settles.';
            })()}
          </div>
        </div>
      </div>

      {/* Your rooms */}
      <div className="px-10 pt-4">
        <div className="font-display font-bold text-md tracking-[2px] uppercase mb-5">Your rooms</div>
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))' }}>
          {roomsLoading &&
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-panel border border-lichen">
                <Skeleton className="h-[130px] w-full" />
                <div className="px-[22px] pt-[18px] pb-[22px]">
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
            ))}
          {!roomsLoading && (myRooms ?? []).length === 0 && (
            <div className="text-lichen text-md">No rooms joined yet.</div>
          )}
          {!roomsLoading &&
            (myRooms ?? []).map((room) => {
            const statusColor = room.isLive ? tokens.flare : tokens.zone;
            return (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className="group no-underline text-bone bg-panel border border-lichen block overflow-hidden transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-bone hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
              >
                <div className="relative h-[130px] overflow-hidden">
                  <img
                    src={mapImageFor(room.config.map)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(180deg, rgba(23,19,16,0.05) 40%, rgba(23,19,16,0.9) 100%)' }}
                  />
                  <div className="absolute left-4 top-4 flex items-center gap-2 bg-ground px-2.5 py-[5px] pointer-events-none">
                    <div className="w-1.5 h-1.5" style={{ background: statusColor }} />
                    <span className="font-mono text-[11px] tracking-[1px]" style={{ color: statusColor }}>
                      {room.isLive ? 'LIVE' : 'JOINED'}
                    </span>
                  </div>
                </div>
                <div className="px-[22px] pt-[18px] pb-[22px]">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display font-bold text-2xl">{room.code}</span>
                    <span className="font-mono text-xs text-lichen">
                      {room.config.mode.toUpperCase()} · {room.config.map.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between mt-3.5 font-mono text-sm">
                    <span className="text-lichen">Staked</span>
                    <span>{formatTokens(room.config.entryFee)}</span>
                  </div>
                  <div className="flex justify-between mt-2 font-mono text-sm">
                    <span className="text-lichen">{room.isLive ? 'Alive' : 'Locks in'}</span>
                    <span style={{ color: statusColor }}>
                      {room.isLive ? `${room.alivePlayers}/${room.config.maxPlayers}` : new Date(room.lockAt).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="px-10 pt-14 pb-[72px]">
        <div className="font-display font-bold text-md tracking-[2px] uppercase mb-5">Recent activity</div>
        {ledgerLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[52px] w-full mb-0.5" />)}
        {!ledgerLoading && (ledger ?? []).length === 0 && <div className="text-lichen text-md">No activity yet.</div>}
        {(ledger ?? []).map((entry) => (
          <div
            key={entry.id}
            className="grid items-center gap-3 px-5 py-3.5 bg-panel mb-0.5"
            style={{ gridTemplateColumns: 'minmax(90px,120px) minmax(0,1fr) 90px 100px' }}
          >
            <span className="font-mono text-sm text-lichen">{entry.createdAt}</span>
            <span className="text-base">{entry.description}</span>
            <span
              className="font-mono text-base tabular-nums"
              style={{ color: entry.status === 'ESCROWED' ? tokens.zone : tokens.bone }}
            >
              {formatSigned(entry.amount)}
            </span>
            <span className="font-mono text-xs text-lichen">{entry.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
