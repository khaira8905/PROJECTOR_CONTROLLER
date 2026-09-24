export type MediaKind = 'image' | 'video' | 'pdf' | 'presentation';
export type DisplayMode = 'media' | 'black' | 'waiting' | 'logo';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface EventSummary {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  venue: string;
  waitingMessage: string;
  logoMediaId: string | null;
  createdAt: string;
  updatedAt: string;
  counts?: { media: number; queueItems: number; scheduleItems: number };
}

export interface EventInput {
  name: string;
  date: string;
  description?: string;
  venue?: string;
  waitingMessage?: string;
  logoMediaId?: string | null;
}

export interface Media {
  id: string;
  eventId: string;
  name: string;
  originalName: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string;
  missing: boolean;
}

export type PublicMedia = Pick<Media, 'id' | 'name' | 'kind' | 'mimeType' | 'url' | 'missing'>;

export interface QueueItem {
  id: string;
  eventId: string;
  mediaId: string;
  position: number;
  title: string | null;
  durationSeconds: number | null;
  notes: string;
  media: Media;
}

export interface ScheduleItem {
  id: string;
  eventId: string;
  time: string;
  title: string;
  description: string;
  durationMinutes: number | null;
}

export interface DisplaySnapshot {
  eventId: string;
  eventName: string;
  eventDate: string;
  waitingMessage: string;
  mode: DisplayMode;
  queueItemId: string | null;
  adHocMediaId: string | null;
  page: number;
  title: string | null;
  media: PublicMedia | null;
  logo: PublicMedia | null;
  version: number;
  serverNow: number;
}

export interface TimerSnapshot {
  eventId: string;
  durationMs: number;
  warningMs: number;
  status: TimerStatus;
  remainingMs: number;
  startedAt: number | null;
  showOnDisplay: boolean;
  serverNow: number;
}

export interface Presence {
  eventId: string;
  displays: number;
  operators: number;
}

export interface UploadResult {
  uploaded: Media[];
  duplicates: Media[];
  rejected: { name: string; error: string }[];
  error?: string;
}

export type ControlCommand =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'show-item'; queueItemId: string }
  | { type: 'show-media'; mediaId: string }
  | { type: 'show-current' }
  | { type: 'black' }
  | { type: 'waiting' }
  | { type: 'logo' }
  | { type: 'page'; page?: number; delta?: number }
  | { type: 'video'; action: 'play' | 'pause' | 'restart' }
  | { type: 'fullscreen' }
  | { type: 'timer-start' }
  | { type: 'timer-pause' }
  | { type: 'timer-toggle' }
  | { type: 'timer-reset' }
  | { type: 'timer-adjust'; deltaMs: number }
  | { type: 'timer-configure'; durationMs?: number; warningMs?: number; showOnDisplay?: boolean };
