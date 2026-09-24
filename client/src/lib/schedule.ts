import type { ScheduleItem } from '../types';

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Splits the schedule into current / next / upcoming using the local wall clock. */
export function scheduleStatus(items: ScheduleItem[], now: Date) {
  const sorted = [...items].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let currentIndex = -1;
  sorted.forEach((item, i) => {
    if (minutesOf(item.time) <= nowMinutes) currentIndex = i;
  });
  const current = currentIndex >= 0 ? sorted[currentIndex] : null;
  // Once the last item's duration (default 60 min) has passed, nothing is current.
  const last = sorted[sorted.length - 1];
  const finished =
    current === last && last && nowMinutes >= minutesOf(last.time) + (last.durationMinutes ?? 60);
  return {
    sorted,
    current: finished ? null : current,
    next: sorted[currentIndex + 1] ?? null,
    upcoming: sorted.slice(currentIndex + 2),
    past: sorted.slice(0, Math.max(0, currentIndex)),
    currentIndex: finished ? -1 : currentIndex,
    minutesUntilNext: sorted[currentIndex + 1] ? minutesOf(sorted[currentIndex + 1].time) - nowMinutes : null,
  };
}
