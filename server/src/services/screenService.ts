import { prisma } from '../lib/prisma';

/** Built-in special screens, created for every event. Their text can be edited; they can't be deleted. */
export const BUILTIN_SCREENS = [
  { key: 'please-wait', style: 'please-wait', title: 'Please Wait', subtitle: 'The presentation will begin shortly.', showTimer: false },
  { key: 'technical', style: 'technical', title: 'Technical Difficulty', subtitle: "We're experiencing a temporary technical difficulty.", showTimer: false },
  { key: 'break', style: 'break', title: "We'll Be Back Shortly", subtitle: 'Grab a coffee — the session resumes soon.', showTimer: true },
  { key: 'starting', style: 'starting', title: 'Session Starting Soon', subtitle: 'Please take your seats.', showTimer: true },
  { key: 'coming-up', style: 'coming-up', title: 'Coming Up Next', subtitle: '', showTimer: false },
  { key: 'thanks', style: 'thanks', title: 'Thank You', subtitle: 'Thank you for joining us.', showTimer: false },
] as const;

export const SCREEN_STYLES = ['please-wait', 'technical', 'break', 'starting', 'coming-up', 'thanks', 'custom'] as const;

const ensured = new Set<string>();

/** Creates any missing built-in screens for an event (idempotent, cheap after the first call). */
export async function ensureBuiltinScreens(eventId: string) {
  if (ensured.has(eventId)) return;
  // Earlier versions used a subtitle that only made sense next to a countdown.
  await prisma.screen.updateMany({
    where: { eventId, key: 'break', subtitle: 'Session resumes in' },
    data: { subtitle: 'Grab a coffee — the session resumes soon.' },
  });
  const existing = await prisma.screen.findMany({ where: { eventId, key: { not: null } }, select: { key: true } });
  const have = new Set(existing.map((s) => s.key));
  let position = 0;
  for (const def of BUILTIN_SCREENS) {
    position++;
    if (have.has(def.key)) continue;
    await prisma.screen.create({ data: { eventId, position, ...def } }).catch(() => {});
  }
  ensured.add(eventId);
}

export function forgetScreens(eventId: string) {
  ensured.delete(eventId);
}

export async function findScreenByKey(eventId: string, key: string) {
  await ensureBuiltinScreens(eventId);
  return prisma.screen.findUnique({ where: { eventId_key: { eventId, key } } });
}
