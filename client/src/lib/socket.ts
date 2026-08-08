import { io, type Socket } from 'socket.io-client';
import { useSessionStore } from '@/app/store';

// Single shared Socket.IO connection to the backend's realtime server
// (server/src/realtime/socket.ts). Auth is optional there (anonymous
// connections can still subscribe to public room broadcasts), but we pass
// the access token when available since some future events may be
// user-scoped (see emitToUser in the backend).
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, {
      autoConnect: true,
      auth: (cb) => cb({ token: useSessionStore.getState().accessToken ?? undefined }),
      withCredentials: true,
    });
  }
  return socket;
}
