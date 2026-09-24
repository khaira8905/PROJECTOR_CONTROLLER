import type { TimerSnapshot } from '../types';

/** Remaining time derived from the authoritative server state and the estimated clock offset. */
export function timerRemaining(timer: TimerSnapshot, clockOffsetMs: number, clientNow = Date.now()): number {
  if (timer.status !== 'running' || timer.startedAt === null) return timer.remainingMs;
  const serverNow = clientNow + clockOffsetMs;
  return Math.max(0, timer.remainingMs - (serverNow - timer.startedAt));
}

export type TimerTone = 'normal' | 'warning' | 'finished' | 'idle';

export function timerTone(timer: TimerSnapshot, remaining: number): TimerTone {
  if (timer.status === 'finished' || (timer.status === 'running' && remaining <= 0)) return 'finished';
  if (timer.status === 'idle') return 'idle';
  if (remaining <= timer.warningMs) return 'warning';
  return 'normal';
}
