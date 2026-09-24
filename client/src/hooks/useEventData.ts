import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { EventSummary, Media, QueueItem, ScheduleItem } from '../types';

/** Loads an event's REST data. Reload functions are triggered by socket change notifications. */
export function useEventData(eventId: string | undefined) {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadEvent = useCallback(async () => {
    if (eventId) setEvent(await api.getEvent(eventId));
  }, [eventId]);
  const reloadMedia = useCallback(async () => {
    if (eventId) setMedia(await api.listMedia(eventId));
  }, [eventId]);
  const reloadQueue = useCallback(async () => {
    if (eventId) setQueue(await api.getQueue(eventId));
  }, [eventId]);
  const reloadSchedule = useCallback(async () => {
    if (eventId) setSchedule(await api.getSchedule(eventId));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([reloadEvent(), reloadMedia(), reloadQueue(), reloadSchedule()])
      .then(() => setError(null))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load event.'))
      .finally(() => setLoading(false));
  }, [eventId, reloadEvent, reloadMedia, reloadQueue, reloadSchedule]);

  return { event, media, queue, schedule, setQueue, error, loading, reloadEvent, reloadMedia, reloadQueue, reloadSchedule };
}
