import { z } from 'zod';

export const idParam = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid id');

export const trimmed = (max: number) => z.string().trim().max(max);

/** Accepts "YYYY-MM-DD" (or a full ISO string) and returns a Date at UTC midnight. */
export const eventDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Use the format YYYY-MM-DD')
  .transform((v) => new Date(`${v.slice(0, 10)}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), 'Invalid date');

export const clockTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the 24h format HH:MM');
