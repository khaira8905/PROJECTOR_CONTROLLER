import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './api';

/**
 * One Socket.IO connection per page. Reconnection is automatic and unlimited;
 * the hooks re-join their event on every (re)connect to receive a fresh snapshot.
 */
export function createSocket(): Socket {
  const options = {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    // Some venue and company networks block WebSockets: fall back to HTTP long-polling
    // instead of never connecting.
    tryAllTransports: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 5000,
  };
  // Same site by default; the API server's address when the UI is hosted separately.
  return API_BASE ? io(API_BASE, options) : io(options);
}

export type AckResponse<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; status?: number };

/** Emits with an acknowledgement and a timeout, resolving to a uniform result. */
export function emitWithAck<T = unknown>(socket: Socket, event: string, payload: unknown, timeoutMs = 4000): Promise<AckResponse<T>> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, error: 'Not connected to the EventControl server. It reconnects on its own — try again in a moment.' });
      return;
    }
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, response: AckResponse<T>) => {
      if (err) resolve({ ok: false, error: 'The server did not answer in time. Check that the EventControl window is still running, then try again.' });
      else resolve(response ?? { ok: false, error: 'No response from server.' });
    });
  });
}
