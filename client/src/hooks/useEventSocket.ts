import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket, emitWithAck, type AckResponse } from '../services/socket';
import type { ControlCommand, DisplaySnapshot, Presence, TimerSnapshot } from '../types';

export interface EventSocketHandlers {
  onQueueChanged?: () => void;
  onMediaChanged?: () => void;
  onScheduleChanged?: () => void;
  onScreensChanged?: () => void;
  onEventChanged?: () => void;
  onEventDeleted?: () => void;
  onVideo?: (action: 'play' | 'pause' | 'restart') => void;
  onFullscreenRequest?: () => void;
  onFullscreenResult?: (ok: boolean) => void;
}

interface JoinData {
  display: DisplaySnapshot;
  timer: TimerSnapshot;
  presence: Presence;
}

/**
 * Connects to the server, joins the event room in the given role and keeps the
 * authoritative display/timer state in React state. On every (re)connect the
 * client re-joins and receives a full snapshot, so a refreshed or briefly
 * disconnected projector restores exactly what it should be showing.
 */
export function useEventSocket(eventId: string | undefined, role: 'operator' | 'display', handlers: EventSocketHandlers = {}) {
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [display, setDisplay] = useState<DisplaySnapshot | null>(null);
  const [timer, setTimer] = useState<TimerSnapshot | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const acceptDisplay = useCallback((next: DisplaySnapshot) => {
    // Ignore out-of-order snapshots.
    setDisplay((prev) => (prev && prev.eventId === next.eventId && prev.version > next.version ? prev : next));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const socket = createSocket();
    socketRef.current = socket;

    const syncClock = async () => {
      const t0 = Date.now();
      const res = await emitWithAck<{ serverNow: number }>(socket, 'clock:ping', null);
      if (res.ok && res.data) {
        const rtt = Date.now() - t0;
        setClockOffset(res.data.serverNow - (t0 + rtt / 2));
      }
    };

    const join = async () => {
      const res = await emitWithAck<JoinData>(socket, 'event:join', { eventId, role }, 8000);
      if (!res.ok) {
        setJoined(false);
        setJoinError(res.error);
        return;
      }
      setJoinError(null);
      setJoined(true);
      if (res.data) {
        acceptDisplay(res.data.display);
        setTimer(res.data.timer);
        setPresence(res.data.presence);
      }
      void syncClock();
    };

    socket.on('connect', () => {
      setConnected(true);
      void join();
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setJoined(false);
    });
    socket.on('display:update', acceptDisplay);
    socket.on('timer:update', (t: TimerSnapshot) => setTimer(t));
    socket.on('presence:update', (p: Presence) => setPresence(p));
    socket.on('queue:changed', () => handlersRef.current.onQueueChanged?.());
    socket.on('media:changed', () => handlersRef.current.onMediaChanged?.());
    socket.on('schedule:changed', () => handlersRef.current.onScheduleChanged?.());
    socket.on('screens:changed', () => handlersRef.current.onScreensChanged?.());
    socket.on('event:changed', () => handlersRef.current.onEventChanged?.());
    socket.on('event:deleted', () => handlersRef.current.onEventDeleted?.());
    socket.on('display:video', (p: { action: 'play' | 'pause' | 'restart' }) => handlersRef.current.onVideo?.(p.action));
    socket.on('display:fullscreen', () => handlersRef.current.onFullscreenRequest?.());
    socket.on('display:fullscreen-result', (p: { ok: boolean }) => handlersRef.current.onFullscreenResult?.(p.ok));

    // Re-sync the clock periodically; drift matters for long countdowns.
    const clockTimer = window.setInterval(() => void syncClock(), 60_000);

    return () => {
      window.clearInterval(clockTimer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [eventId, role, acceptDisplay]);

  const send = useCallback(
    async (command: ControlCommand): Promise<AckResponse> => {
      const socket = socketRef.current;
      if (!socket) return { ok: false, error: 'Not connected to the server.' };
      const res = await emitWithAck(socket, 'control', command);
      if (res.ok && res.data && typeof res.data === 'object') {
        const data = res.data as Partial<DisplaySnapshot & TimerSnapshot>;
        // Apply acknowledged state immediately (the broadcast will confirm it).
        if ('mode' in data && 'version' in data) acceptDisplay(data as DisplaySnapshot);
        else if ('durationMs' in data && 'status' in data) setTimer(data as TimerSnapshot);
      }
      return res;
    },
    [acceptDisplay],
  );

  const emitRaw = useCallback((event: string, payload: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  return { connected, joined, joinError, display, timer, presence, clockOffset, send, emitRaw };
}
