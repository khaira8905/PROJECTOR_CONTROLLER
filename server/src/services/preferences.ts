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

/** How "Black Screen" looks on the projector and how the show comes back from it. */
const blackScreenSchema = z.object({
  /** Offer Black Screen at all (button, Quick Selection, shortcut). */
  enabled: z.boolean(),
  /** Centred event logo on black instead of pure black. */
  showLogo: z.boolean(),
  logoSize: z.enum(['small', 'medium', 'large']),
  logoPosition: z.enum(['center', 'lower', 'corner']),
  /** A slow, gentle entrance for the logo. */
  animateLogo: z.boolean(),
  /** Fade to and from black instead of cutting. */
  fade: z.boolean(),
  /** Optional small line under the logo, e.g. "We’ll be right back". */
  statusText: z.string().trim().max(80),
  /** Next / Previous while black: bring back the same slide, or move on. */
  resume: z.enum(['same', 'advance']),
});

/** What happens when a presentation is opened. */
const presentationSchema = z.object({
  /** Opening a Flow item: at its first slide, or where it was left. */
  startAt: z.enum(['first', 'last']),
  /** Clicking a different Flow item in the middle of a deck asks first. */
  confirmSwitch: z.boolean(),
});

export const preferencesSchema = z.object({
  quickSelection: z.array(quickItemSchema).max(16),
  /** Shown by "Start" when nothing from the flow is on screen yet. */
  defaultMediaId: z.string().max(64).nullable(),
  defaultStartPage: z.number().int().min(1).max(10_000).nullable(),
  /** Black screen asks for a second click (the B key always acts at once). */
  confirmBlack: z.boolean(),
  blackScreen: blackScreenSchema,
  presentation: presentationSchema,
});

export type Preferences = z.infer<typeof preferencesSchema>;
export type QuickItem = z.infer<typeof quickItemSchema>;

export const DEFAULT_QUICK_SELECTION: QuickItem[] = [
  { id: 'qs-wait', kind: 'screen', screenKey: 'please-wait', tone: 'amber' },
  { id: 'qs-tech', kind: 'screen', screenKey: 'technical', tone: 'red' },
  { id: 'qs-break', kind: 'screen', screenKey: 'break', tone: 'blue' },
  { id: 'qs-logo', kind: 'logo' },
];

export const DEFAULT_PREFERENCES: Preferences = {
  quickSelection: DEFAULT_QUICK_SELECTION,
  defaultMediaId: null,
  defaultStartPage: null,
  confirmBlack: true,
  blackScreen: {
    enabled: true,
    showLogo: false,
    logoSize: 'medium',
    logoPosition: 'center',
    animateLogo: true,
    fade: true,
    statusText: '',
    resume: 'same',
  },
  presentation: { startAt: 'first', confirmSwitch: false },
};

export type BlackScreenPrefs = Preferences['blackScreen'];

const NESTED = ['blackScreen', 'presentation'] as const;

/** Reads stored JSON, falling back to defaults for anything missing or unreadable. */
export function parsePreferences(json: string | null | undefined): Preferences {
  let raw: unknown = {};
  try {
    raw = JSON.parse(json || '{}');
  } catch {
    raw = {};
  }
  const stored = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...DEFAULT_PREFERENCES, ...stored };
  // Groups saved by an older version get the newer fields' defaults.
  for (const key of NESTED) merged[key] = { ...DEFAULT_PREFERENCES[key], ...(typeof stored[key] === 'object' ? (stored[key] as object) : {}) };
  const parsed = preferencesSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  // Keep whatever is still valid rather than dropping everything.
  const fallback: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
  for (const [key, schema] of Object.entries(preferencesSchema.shape)) {
    const one = (schema as z.ZodTypeAny).safeParse(merged[key]);
    if (one.success) fallback[key] = one.data;
  }
  return fallback as Preferences;
}

export const preferencesPatchSchema = preferencesSchema.extend({
  blackScreen: blackScreenSchema.partial(),
  presentation: presentationSchema.partial(),
}).partial();

/** Applies a partial update; nested groups are merged field by field. */
export function mergePreferences(existing: Preferences, patch: z.infer<typeof preferencesPatchSchema>): Preferences {
  return {
    ...existing,
    ...patch,
    blackScreen: { ...existing.blackScreen, ...patch.blackScreen },
    presentation: { ...existing.presentation, ...patch.presentation },
  };
}
