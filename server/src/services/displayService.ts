import type { Media, Screen } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { toPublicMediaDto, toScreenDto, type PublicMedia, type ScreenDto } from '../lib/dto';
import { emitToEvent } from '../socket/bus';
import { ensureBuiltinScreens, findScreenByKey } from './screenService';
import * as timer from './timerService';
import { parsePreferences, type BlackScreenPrefs } from './preferences';

/**
 * media  – a presentation/PDF page, image or video
 * screen – a special screen (Please Wait, Technical Difficulty, custom...)
 * black  – nothing at all
 * logo   – the full-screen event logo
 */
export type DisplayMode = 'media' | 'screen' | 'black' | 'logo';
export const DISPLAY_MODES: DisplayMode[] = ['media', 'screen', 'black', 'logo'];

interface DisplayRecord {
  mode: DisplayMode;
  /** The Show Flow cursor: the "current" item. */
  queueItemId: string | null;
  /** Media shown straight from the library; overrides the Show Flow cursor while set. */
  adHocMediaId: string | null;
  /** Screen shown in "screen" mode (null → Please Wait). */
  screenId: string | null;
  /** 1-based page/slide within PDF (and converted PowerPoint) content. */
  page: number;
}

export interface PageRange {
  start: number;
  end: number;
}

export interface OverlayState {
  media: PublicMedia | null;
  position: string;
  size: number;
  opacity: number;
  visible: boolean;
}

/** Everything a display needs to render. Contains no operator-only data (e.g. notes). */
export interface DisplaySnapshot extends DisplayRecord {
  eventId: string;
  eventName: string;
  eventDate: string;
  /** Label of the programmed content (Show Flow item title or media name). */
  title: string | null;
  /** The content rendered in "media" mode. */
  media: PublicMedia | null;
  /** Pages of the current item that NEXT/PREVIOUS walk through. */
  range: PageRange | null;
  /** The screen rendered in "screen" mode. */
  screen: ScreenDto | null;
  logo: PublicMedia | null;
  overlay: OverlayState;
  /** How the projector draws "black" (pure black, or a quiet branded card). */
  blackScreen: BlackScreenPrefs;
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
  const row = await prisma.displayState.upsert({ where: { eventId }, create: { eventId }, update: {} });
  // Databases from earlier versions may contain the old "waiting" mode: that is now the Please Wait screen.
  const mode = DISPLAY_MODES.includes(row.mode as DisplayMode) ? (row.mode as DisplayMode) : 'screen';
  const record: DisplayRecord = { mode, queueItemId: row.queueItemId, adHocMediaId: row.adHocMediaId, screenId: row.screenId, page: row.page };
  records.set(eventId, record);
  return record;
}

/** The pages NEXT/PREVIOUS move through for a piece of media (null when it has no pages). */
export function pageRange(media: Pick<Media, 'pageCount'> | null, startPage?: number | null, endPage?: number | null): PageRange | null {
  const count = media?.pageCount;
  if (!count || count < 1) return null;
  const start = Math.min(Math.max(1, startPage ?? 1), count);
  const end = Math.max(start, Math.min(count, endPage ?? count));
  return { start, end };
}

const hasPages = (m: Media | null) => !!m && (m.kind === 'pdf' || (m.kind === 'presentation' && m.conversionStatus === 'ready')) && !!m.pageCount;

async function buildSnapshot(eventId: string, record: DisplayRecord): Promise<DisplaySnapshot> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Event not found.');

  let title: string | null = null;
  let media: Media | null = null;
  let range: PageRange | null = null;

  const item = record.queueItemId
    ? await prisma.queueItem.findFirst({ where: { id: record.queueItemId, eventId }, include: { media: true, screen: true } })
    : null;
  if (record.queueItemId && !item) record.queueItemId = null;

  if (record.adHocMediaId) {
    media = await prisma.media.findFirst({ where: { id: record.adHocMediaId, eventId } });
    if (media) {
      title = media.name;
      range = hasPages(media) ? pageRange(media) : null;
    } else record.adHocMediaId = null;
  }
  if (!media && item?.kind === 'media' && item.media) {
    media = item.media;
    title = item.title || item.media.name;
    range = hasPages(media) ? pageRange(media, item.startPage, item.endPage) : null;
  }
  if (!media && item?.kind === 'screen' && item.screen) title = item.title || item.screen.title;

  // Keep the page inside the file.
  if (media && hasPages(media)) record.page = Math.min(Math.max(1, record.page), media.pageCount!);

  // The screen for "screen" mode (falls back to Please Wait).
  let screen: (Screen & { background: Media | null }) | null = null;
  await ensureBuiltinScreens(eventId);
  const screenRow =
    (record.screenId && (await prisma.screen.findFirst({ where: { id: record.screenId, eventId } }))) ||
    (await findScreenByKey(eventId, 'please-wait'));
  if (record.screenId && screenRow?.id !== record.screenId) record.screenId = null;
  if (screenRow) {
    const background = screenRow.backgroundMediaId ? await prisma.media.findFirst({ where: { id: screenRow.backgroundMediaId, eventId } }) : null;
    screen = { ...screenRow, background };
    // "Coming Up Next" without a subtitle announces the next Show Flow item automatically.
    if (screen.style === 'coming-up' && !screen.subtitle) screen = { ...screen, subtitle: (await nextItemTitle(eventId, record.queueItemId)) ?? '' };
  }

  const [logoRow, overlayRow] = await Promise.all([
    event.logoMediaId ? prisma.media.findFirst({ where: { id: event.logoMediaId, eventId } }) : null,
    event.overlayMediaId ? prisma.media.findFirst({ where: { id: event.overlayMediaId, eventId } }) : null,
  ]);

  return {
    ...record,
    eventId,
    eventName: event.name,
    eventDate: event.date.toISOString().slice(0, 10),
    title,
    media: media ? toPublicMediaDto(media) : null,
    range,
    screen: screen ? toScreenDto(screen) : null,
    logo: logoRow ? toPublicMediaDto(logoRow) : null,
    overlay: {
      media: overlayRow ? toPublicMediaDto(overlayRow) : null,
      position: event.overlayPosition,
      size: event.overlaySize,
      opacity: event.overlayOpacity,
      visible: event.overlayVisible && !!overlayRow,
    },
    blackScreen: parsePreferences(event.preferences).blackScreen,
    version: ++versionCounter,
    serverNow: Date.now(),
  };
}

async function nextItemTitle(eventId: string, currentId: string | null): Promise<string | null> {
  const items = await prisma.queueItem.findMany({ where: { eventId }, orderBy: { position: 'asc' }, include: { media: true } });
  const idx = currentId ? items.findIndex((i) => i.id === currentId) : -1;
  const next = items.slice(idx + 1).find((i) => i.kind === 'media');
  return next ? next.title || next.media?.name || null : null;
}

function persist(eventId: string, record: DisplayRecord) {
  const data = { ...record };
  // Chain writes per event so a burst of commands is persisted in order.
  const prev = persistChains.get(eventId) ?? Promise.resolve();
  const next = prev
    .then(() => prisma.displayState.upsert({ where: { eventId }, create: { eventId, ...data }, update: data }))
    .catch((err) => logger.error('Failed to persist display state', eventId, err));
  persistChains.set(eventId, next);
}

/**
 * Applies a new display record, broadcasts it, then persists it.
 * `sameContent` changes (black / logo / page flips) reuse the cached snapshot and
 * skip the database entirely so emergency controls are as fast as possible.
 */
async function commit(eventId: string, record: DisplayRecord, sameContent = false): Promise<DisplaySnapshot> {
  records.set(eventId, record);
  if (record.mode === 'media' && record.queueItemId && !record.adHocMediaId) rememberPage(eventId, record.queueItemId, record.page);
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

/** Rebuilds and re-broadcasts the snapshot after Show Flow/media/screen/branding edits. */
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
  lastPages.delete(eventId);
  snapshots.delete(eventId);
  persistChains.delete(eventId);
}

// ---- Show Flow navigation ----------------------------------------------------------

async function flowItems(eventId: string) {
  return prisma.queueItem.findMany({ where: { eventId }, orderBy: { position: 'asc' }, include: { media: true, screen: true } });
}
type FlowItem = Awaited<ReturnType<typeof flowItems>>[number];

const itemRange = (item: FlowItem) => (item.kind === 'media' && hasPages(item.media) ? pageRange(item.media, item.startPage, item.endPage) : null);

/** Puts a Show Flow item on air. Screen items with a duration start the countdown. */
async function goToItem(eventId: string, item: FlowItem, page: number | 'start' | 'end') {
  if (item.kind === 'screen') {
    const snapshot = await commit(eventId, { mode: 'screen', queueItemId: item.id, adHocMediaId: null, screenId: item.screenId, page: 1 });
    if (item.screen?.showTimer) await startScreenTimer(eventId, item.durationSeconds ? item.durationSeconds * 1000 : undefined);
    return snapshot;
  }
  const range = itemRange(item);
  const target = !range ? 1 : page === 'start' ? range.start : page === 'end' ? range.end : Math.min(Math.max(page, range.start), range.end);
  return commit(eventId, { mode: 'media', queueItemId: item.id, adHocMediaId: null, screenId: null, page: target });
}

/**
 * NEXT / PREVIOUS. Walks through the pages of the current presentation (within its
 * slide range), then continues with the next/previous Show Flow item — across
 * separate files, without anyone opening another application.
 */
export async function step(eventId: string, direction: 1 | -1) {
  const record = await loadRecord(eventId);
  const items = await flowItems(eventId);
  if (items.length === 0) throw badRequest('The Show Flow is empty. Add presentations or screens first.');

  const index = record.queueItemId ? items.findIndex((i) => i.id === record.queueItemId) : -1;
  const current = index >= 0 ? items[index] : null;

  // Coming back from black: by default the same slide returns (nothing is skipped while the
  // audience saw nothing). The "advance" setting moves on instead.
  if (record.mode === 'black' && current) {
    const black = (snapshots.get(eventId) ?? (await getSnapshot(eventId))).blackScreen;
    if (black.resume === 'same') return showCurrent(eventId);
  }

  // Ad-hoc content (shown from the library): NEXT continues the flow, PREVIOUS returns to it.
  if (record.adHocMediaId) {
    if (direction === -1 && current) return goToItem(eventId, current, record.page);
    const target = items[index + 1] ?? (index === -1 ? items[0] : null);
    if (!target) throw badRequest('Already at the last item.');
    return goToItem(eventId, target, 'start');
  }

  // Move within the current presentation's pages.
  if (current && current.kind === 'media') {
    const range = itemRange(current);
    if (range) {
      const nextPage = record.page + direction;
      if (nextPage >= range.start && nextPage <= range.end) {
        return commit(eventId, { ...record, mode: 'media', page: nextPage, screenId: null }, true);
      }
    }
  }

  const targetIndex = index === -1 ? (direction === 1 ? 0 : items.length - 1) : index + direction;
  if (targetIndex < 0) throw badRequest('Already at the first item.');
  if (targetIndex >= items.length) throw badRequest('Already at the last item.');
  return goToItem(eventId, items[targetIndex], direction === 1 ? 'start' : 'end');
}

/** Returns to the programmed content ("Resume" / Esc). */
export async function showCurrent(eventId: string) {
  const record = await loadRecord(eventId);
  if (record.adHocMediaId) return commit(eventId, { ...record, mode: 'media', screenId: null });
  const items = await flowItems(eventId);
  const current = items.find((i) => i.id === record.queueItemId) ?? items[0];
  if (!current) throw badRequest('The Show Flow is empty. Add presentations or screens first.');
  if (current.id === record.queueItemId && current.kind === 'media') return commit(eventId, { ...record, mode: 'media', screenId: null }, true);
  return goToItem(eventId, current, current.id === record.queueItemId ? record.page : 'start');
}

export async function showQueueItem(eventId: string, queueItemId: string, page?: number) {
  const items = await flowItems(eventId);
  const item = items.find((i) => i.id === queueItemId);
  if (!item) throw notFound('Show Flow item not found.');
  if (page === undefined) {
    // "Remember last slide": reopening a deck continues where it was left.
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { preferences: true } });
    const remembered = lastPages.get(eventId)?.get(item.id);
    if (remembered && parsePreferences(event?.preferences).presentation.startAt === 'last') return goToItem(eventId, item, remembered);
  }
  return goToItem(eventId, item, page ?? 'start');
}

/** The last slide shown per Flow item (memory only: a restart starts decks from the top). */
const lastPages = new Map<string, Map<string, number>>();
function rememberPage(eventId: string, queueItemId: string, page: number) {
  let pages = lastPages.get(eventId);
  if (!pages) lastPages.set(eventId, (pages = new Map()));
  pages.set(queueItemId, page);
}

export async function showMedia(eventId: string, mediaId: string, page?: number) {
  const media = await prisma.media.findFirst({ where: { id: mediaId, eventId } });
  if (!media) throw notFound('Media not found.');
  const record = await loadRecord(eventId);
  return commit(eventId, { ...record, mode: 'media', adHocMediaId: mediaId, screenId: null, page: page ?? 1 });
}

/** Shows a special screen (by id, or a built-in key such as "please-wait"). Optionally starts the countdown. */
export async function showScreen(eventId: string, opts: { screenId?: string; key?: string; timerMs?: number }) {
  await ensureBuiltinScreens(eventId);
  const screen = opts.screenId
    ? await prisma.screen.findFirst({ where: { id: opts.screenId, eventId } })
    : await findScreenByKey(eventId, opts.key ?? 'please-wait');
  if (!screen) throw notFound('Screen not found.');
  const record = await loadRecord(eventId);
  const snapshot = await commit(eventId, { ...record, mode: 'screen', screenId: screen.id });
  if (opts.timerMs || screen.showTimer) await startScreenTimer(eventId, opts.timerMs);
  return snapshot;
}

/**
 * Makes the countdown visible for a screen. With a duration it (re)starts the countdown;
 * without one it just reveals the timer that is already set. The operator can still hide it.
 */
async function startScreenTimer(eventId: string, durationMs?: number) {
  if (durationMs) {
    // An explicit countdown always starts fresh, even if another one is running.
    await timer.configure(eventId, { durationMs, showOnDisplay: true });
    await timer.reset(eventId);
    await timer.start(eventId);
  } else {
    await timer.configure(eventId, { showOnDisplay: true });
  }
}

export async function setMode(eventId: string, mode: 'black' | 'logo') {
  const record = await loadRecord(eventId);
  return commit(eventId, { ...record, mode }, true);
}

/** Jumps to a page/slide of the current content, or moves relative to it, and puts it on air. */
export async function setPage(eventId: string, opts: { page?: number; delta?: number }) {
  const record = await loadRecord(eventId);
  const snapshot = await getSnapshot(eventId);
  const count = snapshot.media?.pageCount;
  if (!snapshot.media?.pdfUrl || !count) throw badRequest('The current content has no pages.');
  const page = Math.max(1, Math.min(count, opts.page ?? record.page + (opts.delta ?? 0)));
  if (page === record.page && record.mode === 'media') return snapshot;
  return commit(eventId, { ...record, mode: 'media', screenId: null, page }, true);
}

/** Called before Show Flow items, media or screens are deleted so nothing on air dangles. */
export async function handleRemoval(eventId: string, removed: { queueItemIds?: string[]; mediaId?: string; screenId?: string }) {
  const record = await loadRecord(eventId);
  const next = { ...record };
  if (removed.mediaId && next.adHocMediaId === removed.mediaId) {
    next.adHocMediaId = null;
    // Never surprise the audience with different content: fall back to Please Wait.
    if (next.mode === 'media') next.mode = 'screen';
  }
  if (next.queueItemId && removed.queueItemIds?.includes(next.queueItemId)) {
    const ids = (await flowItems(eventId)).map((i) => i.id);
    const idx = ids.indexOf(next.queueItemId);
    const survivors = new Set(ids.filter((id) => !removed.queueItemIds!.includes(id)));
    next.queueItemId = ids.slice(idx + 1).find((id) => survivors.has(id)) ?? ids.slice(0, idx).reverse().find((id) => survivors.has(id)) ?? null;
    next.page = 1;
    if ((next.mode === 'media' && !next.adHocMediaId) || next.mode === 'screen') {
      next.mode = 'screen';
      next.screenId = null;
    }
  }
  if (removed.screenId && next.screenId === removed.screenId) next.screenId = null;
  records.set(eventId, next);
}
