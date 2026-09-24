import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { toPublicMediaDto, type PublicMedia } from '../lib/dto';
import { emitToEvent } from '../socket/bus';

export type DisplayMode = 'media' | 'black' | 'waiting' | 'logo';
export const DISPLAY_MODES: DisplayMode[] = ['media', 'black', 'waiting', 'logo'];

interface DisplayRecord {
  mode: DisplayMode;
  /** The queue cursor: the "current" item. */
  queueItemId: string | null;
  /** Media shown straight from the library; overrides the queue cursor while set. */
  adHocMediaId: string | null;
  /** 1-based page within PDF content. Reset whenever the content changes. */
  page: number;
}

/** Everything a display needs to render. Contains no operator-only data (e.g. notes). */
export interface DisplaySnapshot extends DisplayRecord {
  eventId: string;
  eventName: string;
  eventDate: string;
  waitingMessage: string;
  /** Label of the programmed content (queue item title or media name). */
  title: string | null;
  /** The media rendered in "media" mode. */
  media: PublicMedia | null;
  logo: PublicMedia | null;
  /** Monotonic counter; clients ignore snapshots older than the one they have. */
  version: number;
  serverNow: number;
}

/**
 * The server is the source of truth for what every display shows.
 * State is kept in memory for speed and persisted to SQLite so it survives restarts.
 */
const records = new Map<string, DisplayRecord>();
const snapshots = new Map<string, DisplaySnapshot>();
const persistChains = new Map<string, Promise<unknown>>();
let versionCounter = Date.now();

async function loadRecord(eventId: string): Promise<DisplayRecord> {
  const cached = records.get(eventId);
  if (cached) return cached;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound('Event not found.');
  const row = await prisma.displayState.upsert({
    where: { eventId },
    create: { eventId },
    update: {},
  });
  const record: DisplayRecord = {
    mode: DISPLAY_MODES.includes(row.mode as DisplayMode) ? (row.mode as DisplayMode) : 'waiting',
    queueItemId: row.queueItemId,
    adHocMediaId: row.adHocMediaId,
    page: row.page,
  };
  records.set(eventId, record);
  return record;
}

async function buildSnapshot(eventId: string, record: DisplayRecord): Promise<DisplaySnapshot> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Event not found.');

  let title: string | null = null;
  let media: PublicMedia | null = null;

  if (record.adHocMediaId) {
    const m = await prisma.media.findFirst({ where: { id: record.adHocMediaId, eventId } });
    if (m) {
      media = toPublicMediaDto(m);
      title = m.name;
    } else {
      record.adHocMediaId = null;
    }
  }
  if (record.queueItemId) {
    const item = await prisma.queueItem.findFirst({
      where: { id: record.queueItemId, eventId },
      include: { media: true },
    });
    if (!item) {
      record.queueItemId = null;
    } else if (!media) {
      media = toPublicMediaDto(item.media);
      title = item.title || item.media.name;
    }
  }

  const logoRow = event.logoMediaId
    ? await prisma.media.findFirst({ where: { id: event.logoMediaId, eventId } })
    : null;

  return {
    ...record,
    eventId,
    eventName: event.name,
    eventDate: event.date.toISOString().slice(0, 10),
    waitingMessage: event.waitingMessage,
    title,
    media,
    logo: logoRow ? toPublicMediaDto(logoRow) : null,
    version: ++versionCounter,
    serverNow: Date.now(),
  };
}

function persist(eventId: string, record: DisplayRecord) {
  const data = { ...record };
  // Chain writes per event so a burst of commands is persisted in order.
  const prev = persistChains.get(eventId) ?? Promise.resolve();
  const next = prev
    .then(() =>
      prisma.displayState.upsert({ where: { eventId }, create: { eventId, ...data }, update: data }),
    )
    .catch((err) => logger.error('Failed to persist display state', eventId, err));
  persistChains.set(eventId, next);
}

/**
 * Applies a new display record, broadcasts it, then persists it.
 * `sameContent` changes (black / waiting / logo / PDF page) reuse the cached snapshot
 * and skip the database entirely so emergency controls are as fast as possible.
 */
async function commit(eventId: string, record: DisplayRecord, sameContent = false): Promise<DisplaySnapshot> {
  records.set(eventId, record);
  const cached = snapshots.get(eventId);
  const snapshot: DisplaySnapshot =
    sameContent && cached
      ? { ...cached, mode: record.mode, page: record.page, version: ++versionCounter, serverNow: Date.now() }
      : await buildSnapshot(eventId, record);
  snapshots.set(eventId, snapshot);
  emitToEvent(eventId, 'display:update', snapshot);
  persist(eventId, record);
  return snapshot;
}

export async function getSnapshot(eventId: string): Promise<DisplaySnapshot> {
  const cached = snapshots.get(eventId);
  if (cached) return { ...cached, serverNow: Date.now() };
  const record = await loadRecord(eventId);
  const snapshot = await buildSnapshot(eventId, record);
  snapshots.set(eventId, snapshot);
  return snapshot;
}

/** Rebuilds and re-broadcasts the snapshot after queue/media/event edits. */
export async function refresh(eventId: string): Promise<void> {
  try {
    const record = await loadRecord(eventId);
    await commit(eventId, { ...record });
  } catch (err) {
    logger.error('Failed to refresh display state', eventId, err);
  }
}

export function forget(eventId: string) {
  records.delete(eventId);
  snapshots.delete(eventId);
  persistChains.delete(eventId);
}

async function queueIds(eventId: string): Promise<string[]> {
  const rows = await prisma.queueItem.findMany({
    where: { eventId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function setMode(eventId: string, mode: Exclude<DisplayMode, 'media'>) {
  const record = await loadRecord(eventId);
  return commit(eventId, { ...record, mode }, true);
}

/** Returns to showing the programmed content (queue cursor or ad-hoc media). */
export async function showCurrent(eventId: string) {
  const record = await loadRecord(eventId);
  let { queueItemId } = record;
  if (!queueItemId && !record.adHocMediaId) {
    queueItemId = (await queueIds(eventId))[0] ?? null;
    if (!queueItemId) throw badRequest('The queue is empty. Add media to the queue first.');
  }
  const changed = queueItemId !== record.queueItemId;
  return commit(eventId, { ...record, queueItemId, mode: 'media', page: changed ? 1 : record.page });
}

export async function step(eventId: string, direction: 1 | -1) {
  const record = await loadRecord(eventId);
  const ids = await queueIds(eventId);
  if (ids.length === 0) throw badRequest('The queue is empty. Add media to the queue first.');

  const index = record.queueItemId ? ids.indexOf(record.queueItemId) : -1;
  let target: number;
  if (index === -1) {
    target = direction === 1 ? 0 : ids.length - 1;
  } else if (record.adHocMediaId && direction === -1) {
    // Leaving ad-hoc media with PREVIOUS returns to the current queue item.
    target = index;
  } else {
    target = index + direction;
  }
  if (target < 0) throw badRequest('Already at the first item.');
  if (target >= ids.length) throw badRequest('Already at the last item.');

  return commit(eventId, { mode: 'media', queueItemId: ids[target], adHocMediaId: null, page: 1 });
}

export async function showQueueItem(eventId: string, queueItemId: string) {
  const item = await prisma.queueItem.findFirst({ where: { id: queueItemId, eventId }, select: { id: true } });
  if (!item) throw notFound('Queue item not found.');
  return commit(eventId, { mode: 'media', queueItemId, adHocMediaId: null, page: 1 });
}

export async function showMedia(eventId: string, mediaId: string) {
  const media = await prisma.media.findFirst({ where: { id: mediaId, eventId }, select: { id: true } });
  if (!media) throw notFound('Media not found.');
  const record = await loadRecord(eventId);
  return commit(eventId, { ...record, mode: 'media', adHocMediaId: mediaId, page: 1 });
}

/** Changes the page of PDF content, either absolutely or relative to the current page. */
export async function setPage(eventId: string, opts: { page?: number; delta?: number }) {
  const record = await loadRecord(eventId);
  const page = Math.max(1, Math.min(9999, opts.page ?? record.page + (opts.delta ?? 0)));
  if (page === record.page) return getSnapshot(eventId);
  return commit(eventId, { ...record, page }, true);
}

/** Called before queue items or media are deleted so the cursor never dangles. */
export async function handleRemoval(eventId: string, removed: { queueItemIds?: string[]; mediaId?: string }) {
  const record = await loadRecord(eventId);
  const next = { ...record };
  if (removed.mediaId && next.adHocMediaId === removed.mediaId) next.adHocMediaId = null;
  if (next.queueItemId && removed.queueItemIds?.includes(next.queueItemId)) {
    // Move the cursor to the nearest surviving neighbour.
    const ids = await queueIds(eventId);
    const idx = ids.indexOf(next.queueItemId);
    const survivors = new Set(ids.filter((id) => !removed.queueItemIds!.includes(id)));
    const after = ids.slice(idx + 1).find((id) => survivors.has(id));
    const before = ids.slice(0, idx).reverse().find((id) => survivors.has(id));
    next.queueItemId = after ?? before ?? null;
    next.page = 1;
    // Never surprise the audience with different content: fall back to the waiting screen.
    if (next.mode === 'media' && !next.adHocMediaId) next.mode = 'waiting';
  }
  if (removed.mediaId && record.adHocMediaId === removed.mediaId && next.mode === 'media') {
    next.mode = 'waiting';
  }
  records.set(eventId, next);
}
