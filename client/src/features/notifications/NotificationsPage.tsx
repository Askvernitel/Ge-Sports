import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLedger } from '@/features/wallet/api';
import { fetchMyRooms } from '@/features/rooms/api';
import { formatSigned } from '@/lib/money';
import { tokens } from '@/lib/tokens';
import { Skeleton } from '@/components/Skeleton';

// There's no backend notifications system (no endpoint, no model) — this
// page is a derived, read-only feed built entirely from data the app
// already fetches elsewhere: the wallet ledger (deposits, withdrawals,
// entry-fee escrow, payouts) and the rooms the user has joined (for a
// "settled" event the ledger alone doesn't spell out). Nothing here is
// persisted or dismissible; it's a reformatted view of existing records.

interface FeedItem {
  id: string;
  at: string; // ISO, for sorting
  time: string; // display string, same format as ProfilePage's "Recent activity"
  description: string;
  amount: number | null;
  status: string;
}

export function NotificationsPage() {
  const { data: ledger, isLoading: ledgerLoading } = useQuery({ queryKey: ['ledger'], queryFn: fetchLedger });
  const { data: myRooms, isLoading: roomsLoading } = useQuery({ queryKey: ['rooms', 'mine'], queryFn: fetchMyRooms });
  const isLoading = ledgerLoading || roomsLoading;

  const feed = useMemo<FeedItem[]>(() => {
    const roomCodeById = new Map((myRooms ?? []).map((r) => [r.id, r.code]));

    const ledgerItems: FeedItem[] = (ledger ?? []).map((entry) => {
      const roomCode = entry.refType === 'room' && entry.refId ? roomCodeById.get(entry.refId) : undefined;
      const description =
        entry.type === 'entry_fee' && roomCode
          ? `Entry fee escrowed — ${roomCode}`
          : entry.type === 'entry_refund' && roomCode
            ? `Entry fee refunded — ${roomCode}`
            : entry.type === 'payout' && roomCode
              ? `Match payout — ${roomCode}`
              : entry.description;
      return {
        id: `ledger-${entry.id}`,
        at: entry.createdAt,
        time: new Date(entry.createdAt).toLocaleString(),
        description,
        amount: entry.amount,
        status: entry.status,
      };
    });

    const settledRoomItems: FeedItem[] = (myRooms ?? [])
      .filter((r) => r.settledAt)
      .map((r) => ({
        id: `room-settled-${r.id}`,
        at: r.settledAt as string,
        time: new Date(r.settledAt as string).toLocaleString(),
        description: `Room ${r.code} settled`,
        amount: null,
        status: 'SETTLED',
      }));

    return [...ledgerItems, ...settledRoomItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [ledger, myRooms]);

  return (
    <div>
      <div className="px-10 pt-12 pb-8 border-b border-lichen">
        <h1 className="font-display font-black text-5xl tracking-[1px] uppercase leading-none">Notifications</h1>
        <div className="text-md text-lichen mt-2">Escrow, settlement, and wallet events for your account.</div>
      </div>

      <div className="px-10 pt-8 pb-[72px]" style={{ maxWidth: 820 }}>
        {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[52px] w-full mb-0.5" />)}
        {!isLoading && feed.length === 0 && <div className="text-lichen text-md">No notifications yet.</div>}
        {!isLoading &&
          feed.map((item) => (
            <div
              key={item.id}
              className="grid items-center gap-3 px-5 py-3.5 bg-panel mb-0.5"
              style={{ gridTemplateColumns: 'minmax(90px,150px) minmax(0,1fr) 90px 100px' }}
            >
              <span className="font-mono text-sm text-lichen">{item.time}</span>
              <span className="text-base">{item.description}</span>
              <span
                className="font-mono text-base tabular-nums"
                style={{ color: item.status === 'ESCROWED' ? tokens.zone : tokens.bone }}
              >
                {item.amount === null ? '' : formatSigned(item.amount)}
              </span>
              <span className="font-mono text-xs text-lichen">{item.status}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
