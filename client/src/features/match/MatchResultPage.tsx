import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMatchResult } from './api';
import { formatTokens } from '@/lib/money';
import { Skeleton } from '@/components/Skeleton';

export function MatchResultPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { data: result, isLoading, isError } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => fetchMatchResult(matchId as string),
    enabled: !!matchId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="m-6">
        <Skeleton className="h-12 w-1/2 mb-3" />
        <Skeleton className="h-4 w-1/3 mb-8" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full mb-0.5" />
        ))}
      </div>
    );
  }

  if (isError || !result) {
    return (
      <div className="px-5 sm:px-10 py-16 text-center">
        <div className="font-display font-bold text-2xl uppercase mb-3">Match result not found</div>
        <p className="text-lichen text-md mb-6">
          This match hasn&apos;t settled yet, or the result isn&apos;t available.
        </p>
        <Link to="/rooms" className="text-zone">
          Back to rooms
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 sm:px-6 pt-8 pb-2">
        <h1 className="font-display font-black text-4xl sm:text-5xl tracking-[1px] uppercase leading-none">
          Match result — {result.roomCode}
        </h1>
        <div className="text-md text-lichen mt-1.5">
          {result.mode.toUpperCase()} · {result.map.toUpperCase()} · Settled {result.settledAt}
        </div>
      </div>

      <div className="m-4 sm:m-6">
        <div
          className="hidden sm:grid pb-2.5 border-b border-lichen px-4"
          style={{ gridTemplateColumns: '60px 1fr 90px 90px 110px' }}
        >
          <span className="font-mono text-xs tracking-[1px] text-lichen">RANK</span>
          <span className="font-mono text-xs tracking-[1px] text-lichen">PLAYER</span>
          <span className="font-mono text-xs tracking-[1px] text-lichen">KILLS</span>
          <span className="font-mono text-xs tracking-[1px] text-lichen">POINTS</span>
          <span className="font-mono text-xs tracking-[1px] text-lichen">PAYOUT</span>
        </div>

        {result.rows.map((row) => (
          <div
            key={row.rank}
            className="grid grid-cols-2 gap-x-3 gap-y-1 sm:gap-0 sm:items-center px-4 py-3.5 bg-panel mt-0.5 sm:[grid-template-columns:60px_1fr_90px_90px_110px]"
          >
            <span className="font-display font-bold text-lg">{row.rank}</span>
            <span className="text-base text-right sm:text-left">{row.player}</span>
            <span className="font-mono text-base tabular-nums col-span-2 sm:col-span-1">
              <span className="sm:hidden font-mono text-xs tracking-[1px] text-lichen mr-2">KILLS</span>
              {row.kills}
            </span>
            <span className="font-mono text-base tabular-nums text-lichen col-span-2 sm:col-span-1">
              <span className="sm:hidden font-mono text-xs tracking-[1px] text-lichen mr-2">POINTS</span>
              {row.points}
            </span>
            <span className="font-mono text-md tabular-nums col-span-2 sm:col-span-1">
              <span className="sm:hidden font-mono text-xs tracking-[1px] text-lichen mr-2">PAYOUT</span>
              {formatTokens(row.payout)}
            </span>
          </div>
        ))}

        <div className="flex flex-wrap justify-end gap-3 sm:gap-8 px-4 py-5 mt-2 border-t border-lichen font-mono text-base">
          <span className="text-lichen">
            Pool {formatTokens(result.pool)} − Rake {formatTokens(result.rakeAmount)} =
          </span>
          <span className="text-md">Distributed {formatTokens(result.distributed)}</span>
        </div>
      </div>
    </div>
  );
}
