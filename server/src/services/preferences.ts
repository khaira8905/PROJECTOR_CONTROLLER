import { z } from 'zod';

/**
 * Per-event operator preferences, stored as JSON on the event so every operator
 * console (and a reinstall restoring the database) sees the same set-up.
 */

export const QUICK_KINDS = ['screen', 'media', 'black', 'logo', 'current'] as const;
export const QUICK_TONES = ['amber', 'red', 'blue', 'neutral'] as const;

const quickItemSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(QUICK_KINDS),
  /** A screen by id, or a built-in screen by key (please-wait, technical…). */
  screenId: z.string().max(64).optional(),
  screenKey: z.string().max(40).optional(),
  mediaId: z.string().max(64).optional(),
  page: z.number().int().min(1).max(10_000).optional(),
  label: z.string().trim().max(40).optional(),
  tone: z.enum(QUICK_TONES).optional(),
});

export const preferencesSchema = z.object({
  quickSelection: z.array(quickItemSchema).max(16),
  /** Shown by "Start" when nothing from the flow is on screen yet. */
  defaultMediaId: z.string().max(64).nullable(),
  defaultStartPage: z.number().int().min(1).max(10_000).nullable(),
  /** Black screen asks for a second click (the B key always acts at once). */
  confirmBlack: z.boolean(),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type QuickItem = z.infer<typeof quickItemSchema>;

export const DEFAULT_QUICK_SELECTION: QuickItem[] = [
  { id: 'qs-wait', kind: 'screen', screenKey: 'please-wait', tone: 'amber' },
  { id: 'qs-tech', kind: 'screen', screenKey: 'technical', tone: 'red' },
  { id: 'qs-black', kind: 'black' },
  { id: 'qs-logo', kind: 'logo' },
];

export const DEFAULT_PREFERENCES: Preferences = {
  quickSelection: DEFAULT_QUICK_SELECTION,
  defaultMediaId: null,
  defaultStartPage: null,
  confirmBlack: true,
};

/** Reads stored JSON, falling back to defaults for anything missing or unreadable. */
export function parsePreferences(json: string | null | undefined): Preferences {
  let raw: unknown = {};
  try {
    raw = JSON.parse(json || '{}');
  } catch {
    raw = {};
  }
  const merged = { ...DEFAULT_PREFERENCES, ...(raw && typeof raw === 'object' ? raw : {}) };
  const parsed = preferencesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
}

export const preferencesPatchSchema = preferencesSchema.partial();
