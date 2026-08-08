import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchLiveRooms, fetchRooms } from '@/features/rooms/api';
import { heroTerrainSrc, mapImageFor } from '@/lib/mapAssets';
import { Skeleton } from '@/components/Skeleton';

const STEPS = [
  {
    title: 'Join a room',
    body: 'Filter by mode, map, region and entry fee. Joining escrows the entry fee from your available balance; it stays locked until the room settles.',
  },
  {
    title: 'Play the match',
    body: 'Play in game as normal. The room code is tied to your linked PUBG name, so placement and kills are read from the match record.',
  },
  {
    title: 'Results settle',
    body: 'The pool is distributed from verified results. Rake is shown on the room before you join and again on the result screen.',
  },
];

export function HomePage() {
  const { data: liveRooms, isLoading: liveLoading } = useQuery({ queryKey: ['rooms', 'live'], queryFn: fetchLiveRooms });
  // Unfiltered snapshot across all regions, purely for the hero's stats strip
  // — separate query key from RoomsPage's filtered ['rooms', ...region...] so
  // this doesn't get invalidated/refetched by filter changes over there.
  const { data: allRooms } = useQuery({ queryKey: ['rooms', 'all-for-stats'], queryFn: () => fetchRooms({}) });
  const openCount = (allRooms ?? []).filter((r) => r.status === 'open').length;
  const liveCount = (allRooms ?? []).filter((r) => r.isLive).length;

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-lichen">
        <img src={heroTerrainSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(23,19,16,0.95) 0%, rgba(23,19,16,0.7) 50%, rgba(23,19,16,0.2) 100%)',
          }}
        />
        <div className="relative px-10 pt-20 pb-14 max-w-[680px]">
          <div className="font-mono text-sm tracking-[2px] text-lichen mb-5">SOLANA DEVNET · TEST TOKENS</div>
          <h1
            className="font-display font-black leading-[0.92] tracking-[1px] uppercase"
            style={{ fontSize: 'clamp(40px, 8vw, 88px)' }}
          >
            Stake on your
            <br />
            own match
          </h1>
          <p className="text-md leading-[1.6] mt-5 max-w-[520px]">
            Escrow an entry fee, play the match in game, and the pool is distributed from verified match results.
            Nothing here uses real money.
          </p>
          <div className="flex gap-4 mt-8">
            <Link
              to="/rooms"
              className="bg-zone text-ground text-sm font-semibold no-underline px-7 py-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(62,124,163,0.35)] active:translate-y-0 active:scale-[0.98]"
            >
              Browse rooms
            </Link>
            <Link
              to="/login"
              className="border border-lichen text-bone text-sm font-semibold no-underline px-7 py-3.5 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-bone active:translate-y-0 active:scale-[0.98]"
            >
              Sign in
            </Link>
          </div>

          {/* Modest stats strip — real counts from the same room data the
              Rooms page renders, not a giant single hero number. */}
          <div className="flex gap-8 mt-12 pt-6 border-t border-lichen/40">
            <div>
              <div className="font-mono text-2xl tabular-nums">{allRooms ? openCount : '—'}</div>
              <div className="font-mono text-xs tracking-[1px] text-lichen mt-1">ROOMS OPEN NOW</div>
            </div>
            <div>
              <div className="font-mono text-2xl tabular-nums text-flare">{allRooms ? liveCount : '—'}</div>
              <div className="font-mono text-xs tracking-[1px] text-lichen mt-1">MATCHES LIVE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live now — placed right after the hero as the immediate hook,
          rather than buried below the explainer rows. */}
      <div className="px-10 pt-16 pb-[72px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 bg-flare" />
          <span className="font-display font-bold text-md tracking-[2px] uppercase">Live now</span>
        </div>
        {!liveLoading && (liveRooms ?? []).length === 0 && (
          <div className="text-lichen text-md">No matches live right now.</div>
        )}
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {liveLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-panel border border-lichen">
                <Skeleton className="h-[150px] w-full" />
                <div className="px-6 pt-5 pb-6">
                  <Skeleton className="h-5 w-2/3" />
                </div>
              </div>
            ))}
          {!liveLoading &&
            (liveRooms ?? []).map((room) => (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className="group no-underline text-bone bg-panel border border-lichen block overflow-hidden transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-bone hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
              >
                <div className="relative h-[150px] overflow-hidden">
                  <img
                    src={mapImageFor(room.config.map)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(180deg, rgba(23,19,16,0.1) 40%, rgba(23,19,16,0.85) 100%)' }}
                  />
                </div>
                <div className="px-6 pt-5 pb-6 flex items-baseline justify-between">
                  <span className="font-display font-bold text-xl">{room.code}</span>
                  <span className="font-mono text-sm text-lichen">
                    {room.config.map.toUpperCase()} · {room.alivePlayers} ALIVE
                  </span>
                </div>
              </Link>
            ))}
        </div>
      </div>

      {/* Three ruled rows — no numbering, this is not a sequence */}
      <div className="px-10 py-16 border-t border-lichen">
        {STEPS.map((step) => (
          <div
            key={step.title}
            className="grid grid-cols-1 gap-4 md:gap-10 py-8 border-b border-row-rule items-start md:[grid-template-columns:minmax(200px,320px)_minmax(0,1fr)]"
          >
            <div className="font-display font-bold text-3xl uppercase tracking-[1px]">{step.title}</div>
            <div className="text-md leading-[1.6] max-w-[640px]">{step.body}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-lichen px-10 py-8 font-mono text-xs text-lichen tracking-[1px]">
        DEVNET BUILD · TEST TOKENS HAVE NO MONETARY VALUE
      </div>
    </div>
  );
}
