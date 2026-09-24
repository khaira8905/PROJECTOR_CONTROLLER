import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { emitToEvent } from '../socket/bus';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

interface TimerRecord {
  durationMs: number;
  warningMs: number;
  status: TimerStatus;
  /** Remaining time at `startedAt` (running) or right now (otherwise). */
  remainingMs: number;
  /** Server epoch ms when the current run started; null unless running. */
  startedAt: number | null;
  showOnDisplay: boolean;
}

export interface TimerSnapshot extends TimerRecord {
  eventId: string;
  serverNow: number;
}

/**
 * The authoritative countdown. Clients never count on their own: they receive
 * { remainingMs, startedAt, serverNow } and derive the remaining time from the
 * server clock, so every screen shows the same value even after reconnecting.
 */
const timers = new Map<string, TimerRecord>();
const finishTimeouts = new Map<string, NodeJS.Timeout>();

export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

function remainingNow(t: TimerRecord, now = Date.now()) {
  if (t.status !== 'running' || t.startedAt === null) return t.remainingMs;
  return Math.max(0, t.remainingMs - (now - t.startedAt));
}

function toSnapshot(eventId: string, t: TimerRecord): TimerSnapshot {
  return { eventId, ...t, serverNow: Date.now() };
}

async function load(eventId: string): Promise<TimerRecord> {
  const cached = timers.get(eventId);
  if (cached) return cached;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound('Event not found.');
  const row = await prisma.timerState.upsert({ where: { eventId }, create: { eventId }, update: {} });
  const record: TimerRecord = {
    durationMs: row.durationMs,
    warningMs: row.warningMs,
    status: row.status as TimerStatus,
    remainingMs: row.remainingMs,
    startedAt: row.startedAt ? row.startedAt.getTime() : null,
    showOnDisplay: row.showOnDisplay,
  };
  timers.set(eventId, record);
  scheduleFinish(eventId, record);
  return record;
}

function scheduleFinish(eventId: string, t: TimerRecord) {
  clearTimeout(finishTimeouts.get(eventId));
  finishTimeouts.delete(eventId);
  if (t.status !== 'running') return;
  const ms = remainingNow(t);
  const timeout = setTimeout(() => {
    const current = timers.get(eventId);
    if (!current || current.status !== 'running') return;
    void commit(eventId, { ...current, status: 'finished', remainingMs: 0, startedAt: null });
  }, ms);
  timeout.unref?.();
  finishTimeouts.set(eventId, timeout);
}

async function commit(eventId: string, next: TimerRecord): Promise<TimerSnapshot> {
  timers.set(eventId, next);
  scheduleFinish(eventId, next);
  const snapshot = toSnapshot(eventId, next);
  emitToEvent(eventId, 'timer:update', snapshot);
  try {
    const data = { ...next, startedAt: next.startedAt ? new Date(next.startedAt) : null };
    await prisma.timerState.upsert({ where: { eventId }, create: { eventId, ...data }, update: data });
  } catch (err) {
    logger.error('Failed to persist timer state', eventId, err);
  }
  return snapshot;
}

export async function getTimer(eventId: string): Promise<TimerSnapshot> {
  return toSnapshot(eventId, await load(eventId));
}

export async function start(eventId: string) {
  const t = await load(eventId);
  if (t.status === 'running') return toSnapshot(eventId, t);
  const remainingMs = t.status === 'finished' || t.remainingMs <= 0 ? t.durationMs : t.remainingMs;
  return commit(eventId, { ...t, status: 'running', remainingMs, startedAt: Date.now() });
}

export async function pause(eventId: string) {
  const t = await load(eventId);
  if (t.status !== 'running') return toSnapshot(eventId, t);
  return commit(eventId, { ...t, status: 'paused', remainingMs: remainingNow(t), startedAt: null });
}

export async function toggle(eventId: string) {
  const t = await load(eventId);
  return t.status === 'running' ? pause(eventId) : start(eventId);
}

export async function reset(eventId: string) {
  const t = await load(eventId);
  return commit(eventId, { ...t, status: 'idle', remainingMs: t.durationMs, startedAt: null });
}

/** Adds (or removes, if negative) time to the current countdown. */
export async function adjust(eventId: string, deltaMs: number) {
  const t = await load(eventId);
  const now = Date.now();
  const remaining = Math.min(MAX_DURATION_MS, Math.max(0, remainingNow(t, now) + deltaMs));
  if (t.status === 'running') {
    return commit(eventId, { ...t, remainingMs: remaining, startedAt: now });
  }
  const status: TimerStatus = remaining === 0 ? 'finished' : t.status === 'finished' ? 'paused' : t.status;
  return commit(eventId, { ...t, remainingMs: remaining, status });
}

export async function configure(
  eventId: string,
  opts: { durationMs?: number; warningMs?: number; showOnDisplay?: boolean },
) {
  const t = await load(eventId);
  const next = { ...t };
  if (opts.warningMs !== undefined) next.warningMs = opts.warningMs;
  if (opts.showOnDisplay !== undefined) next.showOnDisplay = opts.showOnDisplay;
  if (opts.durationMs !== undefined) {
    next.durationMs = opts.durationMs;
    // A new duration resets a timer that is not currently counting.
    if (t.status !== 'running') {
      next.status = 'idle';
      next.remainingMs = opts.durationMs;
      next.startedAt = null;
    }
  }
  return commit(eventId, next);
}

export function forget(eventId: string) {
  clearTimeout(finishTimeouts.get(eventId));
  finishTimeouts.delete(eventId);
  timers.delete(eventId);
}

/** Re-arms running timers after a server restart. */
export async function restoreRunningTimers() {
  const rows = await prisma.timerState.findMany({ where: { status: 'running' }, select: { eventId: true } });
  for (const row of rows) {
    const t = await load(row.eventId);
    if (remainingNow(t) <= 0) {
      await commit(row.eventId, { ...t, status: 'finished', remainingMs: 0, startedAt: null });
    }
  }
}

export function stopAll() {
  for (const timeout of finishTimeouts.values()) clearTimeout(timeout);
  finishTimeouts.clear();
  timers.clear();
}
