import { useQuery } from '@tanstack/react-query';
import { fetchRoom, fetchRoomParticipants } from '@/features/rooms/api';

export function useRoom(roomId: string | undefined) {
  return useQuery({
    queryKey: ['room', roomId],
    // fetchRoom resolves to undefined for a 404/unknown id rather than
    // throwing (see rooms/api.ts) — TanStack Query logs a dev warning if a
    // queryFn resolves to undefined, so translate that into a rejection here
    // instead. RoomLobbyPage already renders a "Room not found" state off
    // `!room`, which react-query surfaces as `data: undefined` once the
    // (non-retried) query settles into its error state.
    queryFn: async () => {
      const room = await fetchRoom(roomId as string);
      if (!room) throw new Error('Room not found');
      return room;
    },
    enabled: !!roomId,
    retry: false,
  });
}

export function useRoomParticipants(roomId: string | undefined) {
  return useQuery({
    queryKey: ['room', roomId, 'participants'],
    queryFn: () => fetchRoomParticipants(roomId as string),
    enabled: !!roomId,
  });
}
