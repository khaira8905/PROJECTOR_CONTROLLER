import { parsePreferences } from '../services/preferences';
import type { Event, Media, QueueItem, ScheduleItem, Screen } from '@prisma/client';
import { storedFileExists } from '../services/mediaStorage';

/** A file is only "missing" if it is gone locally and there is no cloud copy to restore it from. */
const isMissing = (m: Media) => !storedFileExists(m.storagePath) && m.cloudStatus !== 'synced';

/** URL of a browser-renderable PDF for this media (PDFs, and PPT/PPTX once converted). */
export function pdfUrlFor(m: Media): string | null {
  if (m.kind === 'pdf') return `/api/media/${m.id}/file`;
  if (m.kind === 'presentation' && m.renderPath && m.conversionStatus === 'ready') return `/api/media/${m.id}/render`;
  return null;
}

/** Media as seen by operators. The storage paths are deliberately omitted. */
export function toMediaDto(m: Media) {
  return {
    id: m.id,
    eventId: m.eventId,
    name: m.name,
    originalName: m.originalName,
    kind: m.kind,
    mimeType: m.mimeType,
    size: m.size,
    folder: m.folder,
    pageCount: m.pageCount,
    conversionStatus: m.conversionStatus,
    conversionError: m.conversionError,
    cloudStatus: m.cloudStatus,
    cloudError: m.cloudError,
    source: m.source,
    createdAt: m.createdAt,
    url: `/api/media/${m.id}/file`,
    pdfUrl: pdfUrlFor(m),
    missing: isMissing(m),
  };
}

/** The subset of media information an audience display needs. */
export function toPublicMediaDto(m: Media) {
  return {
    id: m.id,
    name: m.name,
    kind: m.kind,
    mimeType: m.mimeType,
    url: `/api/media/${m.id}/file`,
    pdfUrl: pdfUrlFor(m),
    pageCount: m.pageCount,
    missing: isMissing(m),
  };
}
export type PublicMedia = ReturnType<typeof toPublicMediaDto>;

export function toScreenDto(s: Screen & { background?: Media | null }) {
  return {
    id: s.id,
    eventId: s.eventId,
    key: s.key,
    title: s.title,
    subtitle: s.subtitle,
    style: s.style,
    showTimer: s.showTimer,
    backgroundMediaId: s.backgroundMediaId,
    background: s.background ? toPublicMediaDto(s.background) : null,
    builtin: !!s.key,
  };
}
export type ScreenDto = ReturnType<typeof toScreenDto>;

export function toQueueItemDto(q: QueueItem & { media: Media | null; screen: Screen | null }) {
  return {
    id: q.id,
    eventId: q.eventId,
    kind: q.kind,
    mediaId: q.mediaId,
    screenId: q.screenId,
    position: q.position,
    title: q.title,
    startPage: q.startPage,
    endPage: q.endPage,
    durationSeconds: q.durationSeconds,
    notes: q.notes,
    media: q.media ? toMediaDto(q.media) : null,
    screen: q.screen ? toScreenDto(q.screen) : null,
  };
}

export function toEventDto(e: Event & { _count?: { media: number; queueItems: number; scheduleItems: number } }) {
  return {
    id: e.id,
    name: e.name,
    date: e.date.toISOString().slice(0, 10),
    description: e.description,
    venue: e.venue,
    waitingMessage: e.waitingMessage,
    logoMediaId: e.logoMediaId,
    overlay: {
      mediaId: e.overlayMediaId,
      position: e.overlayPosition,
      size: e.overlaySize,
      opacity: e.overlayOpacity,
      visible: e.overlayVisible,
    },
    preferences: parsePreferences(e.preferences),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    counts: e._count,
  };
}

export function toScheduleItemDto(s: ScheduleItem) {
  return {
    id: s.id,
    eventId: s.eventId,
    time: s.time,
    title: s.title,
    description: s.description,
    durationMinutes: s.durationMinutes,
  };
}
