import { io, type Socket } from 'socket.io-client';

/**
 * One Socket.IO connection per page. Reconnection is automatic and unlimited;
 * the hooks re-join their event on every (re)connect to receive a fresh snapshot.
 */
export function createSocket(): Socket {
  return io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 5000,
  });
}

export type AckResponse<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/** Emits with an acknowledgement and a timeout, resolving to a uniform result. */
export function emitWithAck<T = unknown>(socket: Socket, event: string, payload: unknown, timeoutMs = 4000): Promise<AckResponse<T>> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, error: 'Not connected to the server.' });
      return;
    }
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, response: AckResponse<T>) => {
      if (err) resolve({ ok: false, error: 'The server did not respond in time.' });
      else resolve(response ?? { ok: false, error: 'No response from server.' });
    });
  });
}
