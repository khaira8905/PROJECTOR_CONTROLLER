import type { Event, Media, QueueItem, ScheduleItem } from '@prisma/client';
import { storedFileExists } from '../services/mediaStorage';

/** Media as seen by clients. The storage path is deliberately omitted. */
export function toMediaDto(m: Media) {
  return {
    id: m.id,
    eventId: m.eventId,
    name: m.name,
    originalName: m.originalName,
    kind: m.kind,
    mimeType: m.mimeType,
    size: m.size,
    createdAt: m.createdAt,
    url: `/api/media/${m.id}/file`,
    missing: !storedFileExists(m.storagePath),
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
    missing: !storedFileExists(m.storagePath),
  };
}
export type PublicMedia = ReturnType<typeof toPublicMediaDto>;

export function toQueueItemDto(q: QueueItem & { media: Media }) {
  return {
    id: q.id,
    eventId: q.eventId,
    mediaId: q.mediaId,
    position: q.position,
    title: q.title,
    durationSeconds: q.durationSeconds,
    notes: q.notes,
    media: toMediaDto(q.media),
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
