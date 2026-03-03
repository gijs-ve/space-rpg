import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@rpg/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(token?: string): Socket<ServerToClientEvents, ClientToServerEvents> | null {
  if (!socket && token) {
    socket = io(API_BASE, {
      auth: { token },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(token: string) {
  if (!socket) {
    socket = io(API_BASE, {
      auth: { token },
      autoConnect: false,
    });
  }
  const s = socket;
  if (!s.connected) {
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}
