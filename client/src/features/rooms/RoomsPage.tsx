import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRooms, MODES, REGIONS } from './api';
import { RoomCard } from './RoomCard';
import { RoomCardSkeleton } from '@/components/Skeleton';
import { legendTerrainSrc } from '@/lib/mapAssets';
import type { Region, RoomMode } from '@/lib/types';
import { tokens } from '@/lib/tokens';

// Filter state lives in the URL search params (region, modes[], feeMin,
// feeMax, openOnly, joinedOnly) so a filtered browse is shareable and
// survives reload — per design README "Interactions & Behavior".

function useRoomFilters() {
  const [params, setParams] = useSearchParams();

  const region = (params.get('region') as Region | null) ?? 'EU';
  const modes = (params.get('modes')?.split(',').filter(Boolean) as RoomMode[]) ?? [];
  const feeMin = Number(params.get('feeMin') ?? 10);
  const feeMax = Number(params.get('feeMax') ?? 200);
  const openOnly = params.get('openOnly') === '1';
  const joinedOnly = params.get('joinedOnly') === '1';

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  return { region, modes, feeMin, feeMax, openOnly, joinedOnly, update };
}

export function RoomsPage() {
  const filters = useRoomFilters();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms', filters.region, filters.modes, filters.feeMin, filters.feeMax, filters.openOnly, filters.joinedOnly],
    queryFn: () =>
      fetchRooms({
        region: filters.region,
        modes: filters.modes,
        feeMin: filters.feeMin,
        feeMax: filters.feeMax,
        openOnly: filters.openOnly,
        joinedOnly: filters.joinedOnly,
      }),
  });

  const openCount = useMemo(() => (rooms ?? []).filter((r) => r.status === 'open').length, [rooms]);
  const liveCount = useMemo(() => (rooms ?? []).filter((r) => r.isLive).length, [rooms]);

  function toggleMode(mode: RoomMode) {
    const next = filters.modes.includes(mode) ? filters.modes.filter((m) => m !== mode) : [...filters.modes, mode];
    filters.update({ modes: next.join(',') || null });
  }

  return (
    <div>
      {/* Compass strip — region filter, doubles as tick-mark nav */}
      <div className="flex items-stretch border-b border-lichen h-[52px] px-10 overflow-x-auto">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => filters.update({ region: r })}
            className="flex items-center h-full px-6 border-l border-lichen bg-transparent border-t-0 border-b-0 border-r-0 cursor-pointer"
          >
            <span
              className="font-mono text-sm tracking-[1px]"
              style={{ color: filters.region === r ? tokens.zone : tokens.lichen }}
            >
              {r}
            </span>
          </button>
        ))}
      </div>

      <div className="px-10 pt-12 pb-2">
        <h1 className="font-display font-black text-6xl tracking-[1px] uppercase leading-none">Rooms</h1>
        <div className="text-md text-lichen mt-2">
          {filters.region} · {openCount} open · {liveCount} live
        </div>
      </div>

      <div className="flex flex-wrap gap-10 px-10 pt-8 pb-[72px] items-start">
        {/* Legend rail */}
        <div className="border border-lichen bg-panel p-7 box-border" style={{ flex: '0 1 260px' }}>
          <div className="font-display font-bold text-sm tracking-[2px] uppercase text-lichen mb-5">Legend</div>

          {MODES.map((mode) => {
            const active = filters.modes.includes(mode);
            return (
              <button
                key={mode}
                onClick={() => toggleMode(mode)}
                className="flex items-center gap-3 mb-3.5 bg-transparent border-none p-0 cursor-pointer w-full text-left"
              >
                <div
                  className="w-3 h-3 border border-bone flex-shrink-0"
                  style={{ background: active ? tokens.lichen : 'transparent' }}
                />
                <span className="text-base text-bone capitalize">{mode}</span>
              </button>
            );
          })}

          <div className="h-px bg-lichen opacity-40 my-7" />

          <div className="font-display font-bold text-sm tracking-[2px] uppercase text-lichen mb-3.5">Fee range</div>
          <div className="font-mono text-xs text-bone flex justify-between mb-2">
            <span>{filters.feeMin}</span>
            <span>{filters.feeMax}</span>
          </div>
          <input
            type="range"
            min={10}
            max={200}
            value={filters.feeMax}
            onChange={(e) => filters.update({ feeMax: e.target.value })}
            className="w-full accent-zone"
          />

          <div className="h-px bg-lichen opacity-40 my-7" />

          <button
            onClick={() => filters.update({ openOnly: filters.openOnly ? null : '1' })}
            className="flex items-center gap-3 mb-3.5 bg-transparent border-none p-0 cursor-pointer w-full text-left"
          >
            <div
              className="w-3 h-3 border border-bone"
              style={{ background: filters.openOnly ? tokens.bone : 'transparent' }}
            />
            <span className="text-base">Open only</span>
          </button>
          <button
            onClick={() => filters.update({ joinedOnly: filters.joinedOnly ? null : '1' })}
            className="flex items-center gap-3 bg-transparent border-none p-0 cursor-pointer w-full text-left"
          >
            <div
              className="w-3 h-3 border border-bone"
              style={{ background: filters.joinedOnly ? tokens.bone : 'transparent' }}
            />
            <span className="text-base">Rooms I joined</span>
          </button>

          <div className="h-px bg-lichen opacity-40 my-7" />

          <div className="font-display font-bold text-sm tracking-[2px] uppercase text-lichen mb-3.5">EU sector</div>
          <img src={legendTerrainSrc} alt="Region map" className="w-full h-[150px] object-cover" />
        </div>

        {/* Room grid */}
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          {!isLoading && (rooms ?? []).length === 0 && (
            <div className="text-lichen text-md">
              No rooms match these filters. Widen the fee range or clear the region.
            </div>
          )}
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))' }}>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <RoomCardSkeleton key={i} />)
              : (rooms ?? []).map((room) => <RoomCard key={room.id} room={room} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
