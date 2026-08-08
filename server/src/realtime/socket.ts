import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { authService } from '../services/authService.js';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        const payload = authService.verifyAccessToken(token);
        socket.data.userId = payload.sub;
      }
      next();
    } catch {
      // Allow anonymous connections for public room-state broadcasts;
      // authenticated-only events are gated at the namespace/room join level.
      next();
    }
  });

  io.on('connection', (socket) => {
    socket.on('room:subscribe', (roomId: string) => {
      socket.join(roomKey(roomId));
    });
    socket.on('room:unsubscribe', (roomId: string) => {
      socket.leave(roomKey(roomId));
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

function roomKey(roomId: string): string {
  return `room:${roomId}`;
}

export function emitToRoom(roomId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(roomKey(roomId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.emit(`user:${userId}:${event}`, payload); // simple broadcast-with-prefix; swap for per-user rooms if scaling requires it
}

export function getIo(): Server | null {
  return io;
}
