import type { TimerSnapshot } from '../types';

/** Remaining time derived from the authoritative server state and the estimated clock offset. */
export function timerRemaining(timer: TimerSnapshot, clockOffsetMs: number, clientNow = Date.now()): number {
  if (timer.status !== 'running' || timer.startedAt === null) return timer.remainingMs;
  const serverNow = clientNow + clockOffsetMs;
  return Math.max(0, timer.remainingMs - (serverNow - timer.startedAt));
}

/** How long a finished countdown has been over time (0 unless it has finished). */
export function timerOvertime(timer: TimerSnapshot, clockOffsetMs: number, clientNow = Date.now()): number {
  if (timer.status !== 'finished' || !timer.finishedAt) return 0;
  return Math.max(0, clientNow + clockOffsetMs - timer.finishedAt);
}

export type TimerTone = 'normal' | 'warning' | 'finished' | 'idle';

export function timerTone(timer: TimerSnapshot, remaining: number): TimerTone {
  if (timer.status === 'finished' || (timer.status === 'running' && remaining <= 0)) return 'finished';
  if (timer.status === 'idle') return 'idle';
  // Countdowns shorter than the warning threshold would otherwise start in "warning".
  if (remaining <= timer.warningMs && timer.durationMs > timer.warningMs) return 'warning';
  return 'normal';
}
