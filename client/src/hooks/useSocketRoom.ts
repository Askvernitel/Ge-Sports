import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';

// Real Socket.IO room-state realtime updates (spec section 1: "Realtime:
// Socket.IO for room state, match state, balance updates"), replacing the
// former 15s-poll placeholder. Backend emits (server/src/realtime/socket.ts
// + roomService.ts/matchService.ts/settlementService.ts):
//   room:joined, room:left, room:started, room:settled, room:disputed,
//   match:verified
// all scoped to a `room:<roomId>` Socket.IO room via `room:subscribe`.
export function useSocketRoom(roomId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    const invalidateAll = () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    };

    socket.emit('room:subscribe', roomId);
    socket.on('room:joined', invalidate);
    socket.on('room:left', invalidate);
    socket.on('room:started', invalidate);
    socket.on('room:settled', invalidateAll);
    socket.on('room:disputed', invalidateAll);
    socket.on('match:verified', invalidateAll);

    // Fallback safety net: if the socket is mid-reconnect, don't leave the
    // UI fully stale for more than 15s (same cadence the old poll used).
    const interval = setInterval(invalidate, 15_000);

    return () => {
      socket.emit('room:unsubscribe', roomId);
      socket.off('room:joined', invalidate);
      socket.off('room:left', invalidate);
      socket.off('room:started', invalidate);
      socket.off('room:settled', invalidateAll);
      socket.off('room:disputed', invalidateAll);
      socket.off('match:verified', invalidateAll);
      clearInterval(interval);
    };
  }, [roomId, queryClient]);
}
