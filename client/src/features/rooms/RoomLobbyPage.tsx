import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoom, useRoomParticipants } from '@/hooks/useRoom';
import { useSocketRoom } from '@/hooks/useSocketRoom';
import { useCountdown } from '@/hooks/useCountdown';
import { ZoneRing } from '@/components/ZoneRing';
import { lobbyTerrainSrc } from '@/lib/mapAssets';
import { computeRake, computeDistributable, formatTokens } from '@/lib/money';
import { friendlyErrorMessage } from '@/lib/errorCopy';
import { tokens } from '@/lib/tokens';
import { LOCK_WINDOW_MS, leaveRoom, joinRoom, startRoom } from './api';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { useSessionStore } from '@/app/store';

export function RoomLobbyPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: room, isLoading } = useRoom(roomId);
  const { data: participants } = useRoomParticipants(roomId);
  const userId = useSessionStore((s) => s.user?.id);
  useSocketRoom(roomId);

  const countdown = useCountdown(room?.lockAt ?? new Date().toISOString(), LOCK_WINDOW_MS);

  const leaveMutation = useMutation({
    mutationFn: () => leaveRoom(roomId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      navigate('/rooms');
    },
  });

  const joinMutation = useMutation({
    mutationFn: () => joinRoom(roomId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startRoom(roomId as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['room', roomId] }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:[grid-template-columns:1fr_380px]">
        <div className="relative overflow-hidden border-r-0 lg:border-r border-b lg:border-b-0 border-lichen flex items-center justify-center" style={{ minHeight: 400 }}>
          <Skeleton className="w-[220px] h-[220px] zone-ring" />
        </div>
        <div className="p-8">
          <Skeleton className="h-4 w-1/2 mb-4" />
          <Skeleton className="h-10 w-full mb-2.5" />
          <Skeleton className="h-10 w-full mb-6" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="px-10 py-16 text-center">
        <div className="font-display font-bold text-2xl uppercase mb-3">Room not found</div>
        <p className="text-lichen text-md mb-6">
          This room doesn&apos;t exist, or it's no longer open.
        </p>
        <Link to="/rooms" className="text-zone">
          Back to rooms
        </Link>
      </div>
    );
  }

  const entries = room.seatsFilled;
  const fee = room.config.entryFee;
  const pool = entries * fee;
  const rake = computeRake(pool, room.rakeBps);
  const distributed = computeDistributable(pool, room.rakeBps);

  return (
    <div className="grid grid-cols-1 lg:[grid-template-columns:1fr_380px]">
      <div className="relative overflow-hidden border-r-0 lg:border-r border-b lg:border-b-0 border-lichen" style={{ minHeight: 400 }}>
        <img
          src={lobbyTerrainSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.6 }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 45%, rgba(23,19,16,0.2) 0%, rgba(23,19,16,0.85) 70%)',
          }}
        />
        <div className="relative flex flex-col items-center justify-center py-10" style={{ minHeight: 400 }}>
          <ZoneRing pct={countdown.pct} size={220} discSize={186}>
            <span className="font-display font-black text-[40px] tracking-[1px]">{room.code}</span>
            <span className="font-mono text-md text-zone mt-1">{countdown.label}</span>
          </ZoneRing>
          <span className="font-mono text-sm tracking-[1px] text-lichen mt-4">
            {room.config.mode.toUpperCase()} · {room.config.map.toUpperCase()} · LOCKS IN {countdown.label}
          </span>
        </div>
      </div>

      <div className="p-8">
        <div className="font-display font-bold text-sm tracking-[2px] uppercase text-lichen mb-4">
          Participants — {entries}/{room.config.maxPlayers}
        </div>
        {(participants ?? []).map((p) => (
          <div key={p.userId} className="flex items-center justify-between py-2.5 border-b border-row-rule">
            <a href={p.profileUrl} className="text-base no-underline text-bone">
              {p.name}
            </a>
            <span className="font-mono text-sm text-lichen">{p.status}</span>
          </div>
        ))}

        <div className="h-px bg-lichen opacity-40 my-6" />

        <div className="font-display font-bold text-sm tracking-[2px] uppercase text-lichen mb-3">Prize pool</div>
        <div className="flex justify-between font-mono text-sm mb-1.5">
          <span className="text-lichen">
            Entries ({entries} × {fee})
          </span>
          <span>{formatTokens(pool)}</span>
        </div>
        <div className="flex justify-between font-mono text-sm mb-1.5">
          <span className="text-lichen">Rake ({(room.rakeBps / 100).toString().replace(/\.0$/, '')}%)</span>
          <span>−{formatTokens(rake)}</span>
        </div>
        <div className="flex justify-between font-mono text-lg pt-2.5 border-t border-lichen">
          <span>Distributed</span>
          <span>{formatTokens(distributed)}</span>
        </div>

        {!room.joinedByMe && room.status === 'open' && (
          <Button
            variant="primary"
            className="mt-8 w-full"
            onClick={() => joinMutation.mutate()}
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? 'Joining…' : 'Join room'}
          </Button>
        )}

        {room.createdBy === userId && room.status === 'open' && (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? 'Starting…' : 'Start room'}
          </Button>
        )}

        {room.joinedByMe && room.status === 'open' && (
          <Button
            variant="destructive"
            className="mt-3 w-full"
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
          >
            {leaveMutation.isPending ? 'Leaving…' : 'Leave room'}
          </Button>
        )}

        {joinMutation.isError && (
          <div className="text-xs mt-3" style={{ color: tokens.flare }}>
            {friendlyErrorMessage(joinMutation.error)}
          </div>
        )}
        {startMutation.isError && (
          <div className="text-xs mt-3" style={{ color: tokens.flare }}>
            {friendlyErrorMessage(startMutation.error)}
          </div>
        )}
        {leaveMutation.isError && (
          <div className="text-xs mt-3" style={{ color: tokens.flare }}>
            {friendlyErrorMessage(leaveMutation.error)}
          </div>
        )}
      </div>
    </div>
  );
}
