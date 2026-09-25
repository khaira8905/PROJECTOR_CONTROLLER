import type { AuthStatus, EventInput, EventSummary, Media, QueueItem, ScheduleItem, Screen, ScreenStyle, SystemStatus, UploadResult } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    });
  } catch {
    throw new ApiError('Cannot reach the EventControl server. Is it running?', 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && data?.code === 'UNAUTHENTICATED') {
    // Session expired: the auth gate listens for this and shows the sign-in page.
    window.dispatchEvent(new Event('eventcontrol:unauthenticated'));
  }
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data?.code);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  authStatus: () => request<AuthStatus>('/api/auth/status'),
  setupPassword: (password: string) => request<{ ok: true }>('/api/auth/setup', { method: 'POST', body: json({ password }) }),
  login: (password: string, email?: string) => request<{ ok: true }>('/api/auth/login', { method: 'POST', body: json({ password, email }) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/api/auth/change-password', { method: 'POST', body: json({ currentPassword, newPassword }) }),
  status: () => request<SystemStatus>('/api/status'),

  listEvents: () => request<EventSummary[]>('/api/events'),
  getEvent: (id: string) => request<EventSummary>(`/api/events/${id}`),
  createEvent: (input: EventInput) => request<EventSummary>('/api/events', { method: 'POST', body: json(input) }),
  updateEvent: (id: string, input: Partial<EventInput>) =>
    request<EventSummary>(`/api/events/${id}`, { method: 'PUT', body: json(input) }),
  deleteEvent: (id: string) => request<void>(`/api/events/${id}`, { method: 'DELETE' }),

  listMedia: (eventId: string) => request<Media[]>(`/api/events/${eventId}/media`),
  renameMedia: (id: string, name: string) => request<Media>(`/api/media/${id}`, { method: 'PATCH', body: json({ name }) }),
  moveMedia: (id: string, folder: string) => request<Media>(`/api/media/${id}`, { method: 'PATCH', body: json({ folder }) }),
  reconvertMedia: (id: string) => request<{ ok: true }>(`/api/media/${id}/convert`, { method: 'POST' }),
  deleteMedia: (id: string) => request<void>(`/api/media/${id}`, { method: 'DELETE' }),
  openMediaExternally: (id: string) => request<{ ok: true }>(`/api/media/${id}/open`, { method: 'POST' }),

  /** Upload with progress reporting (fetch has no upload progress, so use XHR). */
  uploadMedia: (eventId: string, files: File[], onProgress?: (fraction: number) => void, folder = '') =>
    new Promise<UploadResult>((resolve, reject) => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f, f.name));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/events/${eventId}/media${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onerror = () => reject(new ApiError('Unable to upload file. Check the server connection.', 0));
      xhr.onload = () => {
        let data: any = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON error */
        }
        if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data as UploadResult);
        else if (xhr.status === 400 && data?.rejected) resolve(data as UploadResult);
        else reject(new ApiError(data?.error ?? 'Unable to upload file.', xhr.status));
      };
      xhr.send(form);
    }),

  getQueue: (eventId: string) => request<QueueItem[]>(`/api/events/${eventId}/queue`),
  addToQueue: (eventId: string, mediaId: string, extra: { title?: string; notes?: string; startPage?: number | null; endPage?: number | null } = {}) =>
    request<QueueItem>(`/api/events/${eventId}/queue`, { method: 'POST', body: json({ mediaId, ...extra }) }),
  addScreenToFlow: (eventId: string, screenId: string, durationSeconds?: number | null) =>
    request<QueueItem>(`/api/events/${eventId}/queue`, { method: 'POST', body: json({ kind: 'screen', screenId, durationSeconds: durationSeconds ?? null }) }),
  reorderQueue: (eventId: string, order: string[]) =>
    request<QueueItem[]>(`/api/events/${eventId}/queue`, { method: 'PUT', body: json({ order }) }),
  updateQueueItem: (
    id: string,
    patch: { title?: string | null; notes?: string; durationSeconds?: number | null; startPage?: number | null; endPage?: number | null },
  ) =>
    request<QueueItem>(`/api/queue/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteQueueItem: (id: string) => request<void>(`/api/queue/${id}`, { method: 'DELETE' }),

  listScreens: (eventId: string) => request<Screen[]>(`/api/events/${eventId}/screens`),
  createScreen: (eventId: string, input: ScreenInput) => request<Screen>(`/api/events/${eventId}/screens`, { method: 'POST', body: json(input) }),
  updateScreen: (id: string, input: Partial<ScreenInput>) => request<Screen>(`/api/screens/${id}`, { method: 'PATCH', body: json(input) }),
  deleteScreen: (id: string) => request<void>(`/api/screens/${id}`, { method: 'DELETE' }),

  getSchedule: (eventId: string) => request<ScheduleItem[]>(`/api/events/${eventId}/schedule`),
  addScheduleItem: (eventId: string, item: Omit<ScheduleItem, 'id' | 'eventId'>) =>
    request<ScheduleItem>(`/api/events/${eventId}/schedule`, { method: 'POST', body: json(item) }),
  updateScheduleItem: (id: string, patch: Partial<Omit<ScheduleItem, 'id' | 'eventId'>>) =>
    request<ScheduleItem>(`/api/schedule/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteScheduleItem: (id: string) => request<void>(`/api/schedule/${id}`, { method: 'DELETE' }),
};

export const ACCEPTED_FILE_TYPES = '.ppt,.pptx,.pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov';

export interface ScreenInput {
  title: string;
  subtitle: string;
  style: ScreenStyle;
  showTimer: boolean;
  backgroundMediaId: string | null;
}
