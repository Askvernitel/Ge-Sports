import { Link } from 'react-router-dom';
import type { Room } from '@/lib/types';
import { mapImageFor } from '@/lib/mapAssets';
import { formatTokens } from '@/lib/money';
import { useCountdown } from '@/hooks/useCountdown';
import { ZoneRing, zoneRingColor } from '@/components/ZoneRing';
import { LOCK_WINDOW_MS } from './api';
import { tokens } from '@/lib/tokens';

export function RoomCard({ room }: { room: Room }) {
  const countdown = useCountdown(room.lockAt, LOCK_WINDOW_MS);
  const ringColor = zoneRingColor(countdown.pct);

  const statusLabel = room.isLive ? 'LIVE' : room.joinedByMe ? 'JOINED' : 'OPEN';
  const statusColor = room.isLive ? tokens.flare : room.joinedByMe ? tokens.zone : tokens.lichen;
  const ctaLabel = room.joinedByMe || room.isLive ? 'Open lobby' : 'Join room';

  return (
    <div className="group bg-panel border border-lichen flex flex-col transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-bone hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
      <div className="relative h-[150px] overflow-hidden">
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
            {statusLabel}
          </span>
        </div>
        <div className="absolute left-4 bottom-3.5 flex items-baseline gap-3 pointer-events-none">
          <span className="font-display font-bold text-4xl leading-none">{room.code}</span>
          <span className="font-mono text-xs tracking-[1px] text-bone">
            {room.config.mode.toUpperCase()} · {room.config.map.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="px-6 pt-5 pb-6 flex flex-col gap-3 flex-1">
        <div className="flex justify-between font-mono text-sm">
          <span className="text-lichen">Entry fee</span>
          <span className="tabular-nums">{formatTokens(room.config.entryFee)}</span>
        </div>
        <div className="flex justify-between font-mono text-sm">
          <span className="text-lichen">Seats</span>
          <span className="tabular-nums">
            {room.seatsFilled}/{room.config.maxPlayers}
          </span>
        </div>
        <div className="flex justify-between items-center font-mono text-sm">
          <span className="text-lichen">{room.isLive ? 'Alive' : 'Locks in'}</span>
          <span className="flex items-center gap-2.5">
            {room.isLive ? (
              <span className="tabular-nums" style={{ color: tokens.flare }}>
                {room.alivePlayers}
              </span>
            ) : (
              <>
                <ZoneRing pct={countdown.pct} size={20} />
                <span className="tabular-nums" style={{ color: ringColor }}>
                  {countdown.label}
                </span>
              </>
            )}
          </span>
        </div>
        <Link
          to={`/rooms/${room.id}`}
          className="mt-2 text-left no-underline text-sm font-semibold px-[18px] py-3 transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.98]"
          style={{
            background: room.joinedByMe || room.isLive ? 'transparent' : tokens.zone,
            color: room.joinedByMe || room.isLive ? tokens.bone : tokens.ground,
            border: `1px solid ${room.joinedByMe || room.isLive ? tokens.lichen : tokens.zone}`,
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
