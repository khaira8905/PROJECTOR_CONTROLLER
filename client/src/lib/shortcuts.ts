/**
 * Presenter keyboard shortcuts: the actions, their default keys, and how a key press is
 * written down ("ArrowRight", "Space", "Shift+F"). The operator can change keys in
 * Settings → Controls; changes are kept on this computer (see uiPrefs).
 */

export type ShortcutAction =
  | 'next'
  | 'previous'
  | 'start'
  | 'resume'
  | 'exit'
  | 'goToSlide'
  | 'black'
  | 'openFlow'
  | 'selectPresentation'
  | 'toggleControls'
  | 'fullscreen'
  | 'pleaseWait'
  | 'technical'
  | 'overlay'
  | 'timerToggle'
  | 'timerReset'
  | 'quick1'
  | 'quick2'
  | 'quick3'
  | 'quick4'
  | 'quick5'
  | 'quick6'
  | 'quick7'
  | 'quick8'
  | 'help';

export interface ShortcutDef {
  id: ShortcutAction;
  label: string;
  group: 'Presenting' | 'Navigation' | 'Screens & timer' | 'Quick Selection';
  keys: string[];
  hint?: string;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: 'next', label: 'Next slide', group: 'Presenting', keys: ['ArrowRight', 'Space', 'PageDown'], hint: 'At the last slide, moves to the next Flow item.' },
  { id: 'previous', label: 'Previous slide', group: 'Presenting', keys: ['ArrowLeft', 'PageUp'] },
  { id: 'start', label: 'Start presentation', group: 'Presenting', keys: ['S'], hint: 'Starts the default presentation, or the first Flow item.' },
  { id: 'resume', label: 'Back to the presentation', group: 'Presenting', keys: ['Escape'], hint: 'Leaves black, a quick screen or a library file.' },
  { id: 'exit', label: 'Exit presentation', group: 'Presenting', keys: ['L'], hint: 'Leaves the slides and shows the logo screen.' },
  { id: 'black', label: 'Black screen', group: 'Presenting', keys: ['B'], hint: 'Press again to come back.' },
  { id: 'goToSlide', label: 'Go to slide number', group: 'Presenting', keys: ['G'] },
  { id: 'openFlow', label: 'Open Flow', group: 'Navigation', keys: ['Shift+F'], hint: 'Jumps to the Control view from anywhere.' },
  { id: 'selectPresentation', label: 'Select presentation', group: 'Navigation', keys: ['/'], hint: 'Moves the focus into the Flow: ↑ ↓ to choose, Enter to show.' },
  { id: 'toggleControls', label: 'Show / hide controls', group: 'Navigation', keys: ['H'], hint: 'Presenter mode: only the Flow and the buttons.' },
  { id: 'help', label: 'Shortcut overview', group: 'Navigation', keys: ['?'] },
  { id: 'fullscreen', label: 'Projector fullscreen', group: 'Screens & timer', keys: ['F'] },
  { id: 'pleaseWait', label: 'Please Wait screen', group: 'Screens & timer', keys: ['W'] },
  { id: 'technical', label: 'Technical Difficulty screen', group: 'Screens & timer', keys: ['T'] },
  { id: 'overlay', label: 'Logo overlay on / off', group: 'Screens & timer', keys: ['O'] },
  { id: 'timerToggle', label: 'Start / pause timer', group: 'Screens & timer', keys: ['P'] },
  { id: 'timerReset', label: 'Reset timer', group: 'Screens & timer', keys: ['R'] },
  ...([1, 2, 3, 4, 5, 6, 7, 8] as const).map((n) => ({
    id: `quick${n}` as ShortcutAction,
    label: `Quick Selection button ${n}`,
    group: 'Quick Selection' as const,
    keys: [String(n)],
  })),
];

export const SHORTCUT_BY_ID = Object.fromEntries(SHORTCUT_DEFS.map((d) => [d.id, d])) as Record<ShortcutAction, ShortcutDef>;

export type ShortcutOverrides = Partial<Record<ShortcutAction, string[]>>;

/** Keys that already mean something while working in the page. */
const RESERVED: Record<string, string> = {
  Tab: 'Tab moves between buttons.',
  Enter: 'Enter presses the focused button.',
  'Shift+Tab': 'Shift+Tab moves between buttons.',
  ArrowUp: '↑ and ↓ choose items in the Flow.',
  ArrowDown: '↑ and ↓ choose items in the Flow.',
};

export const reservedReason = (combo: string) => RESERVED[combo] ?? null;

/**
 * A key press written as a combo: modifiers first, then the key. Letters are upper-case
 * and Shift is written out ("Shift+F"); symbols keep their own character ("?", not "Shift+/").
 * Returns null for bare modifier presses.
 */
export function comboFromEvent(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>): string | null {
  const { key } = e;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Unidentified'].includes(key)) return null;
  const mods: string[] = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.metaKey) mods.push('Meta');
  if (e.altKey) mods.push('Alt');
  let base = key === ' ' ? 'Space' : key;
  const letter = /^[a-z]$/i.test(base);
  if (letter) base = base.toUpperCase();
  if (e.shiftKey && (letter || base.length > 1)) mods.push('Shift');
  return [...mods, base].join('+');
}

const PRETTY: Record<string, string> = {
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  PageDown: 'Page Down',
  PageUp: 'Page Up',
  Space: 'Space',
  Backspace: '⌫',
  Delete: 'Del',
};

/** "Shift+ArrowRight" → ["Shift", "→"], for showing as key caps. */
export const comboParts = (combo: string) => combo.split('+').map((p) => PRETTY[p] ?? p);
export const prettyCombo = (combo: string) => comboParts(combo).join(' + ');

/** The keys in effect: defaults, with the operator's changes on top. */
export function effectiveBindings(overrides: ShortcutOverrides | undefined): Record<ShortcutAction, string[]> {
  const out = {} as Record<ShortcutAction, string[]>;
  for (const def of SHORTCUT_DEFS) out[def.id] = overrides?.[def.id] ?? def.keys;
  return out;
}

/** Keys bound to more than one action: combo → the actions that share it. */
export function findConflicts(bindings: Record<ShortcutAction, string[]>): Map<string, ShortcutAction[]> {
  const byKey = new Map<string, ShortcutAction[]>();
  for (const [action, keys] of Object.entries(bindings) as [ShortcutAction, string[]][]) {
    for (const k of keys) byKey.set(k, [...(byKey.get(k) ?? []), action]);
  }
  return new Map([...byKey].filter(([, actions]) => actions.length > 1));
}

/** Which action (other than `except`) already uses this combo. */
export function ownerOf(bindings: Record<ShortcutAction, string[]>, combo: string, except?: ShortcutAction): ShortcutAction | null {
  for (const [action, keys] of Object.entries(bindings) as [ShortcutAction, string[]][]) {
    if (action !== except && keys.includes(combo)) return action;
  }
  return null;
}

/** Stores only what differs from the defaults, so future default changes still arrive. */
export function withBinding(overrides: ShortcutOverrides | undefined, action: ShortcutAction, keys: string[]): ShortcutOverrides {
  const next = { ...overrides };
  const same = keys.length === SHORTCUT_BY_ID[action].keys.length && keys.every((k, i) => k === SHORTCUT_BY_ID[action].keys[i]);
  if (same) delete next[action];
  else next[action] = keys;
  return next;
}

/** Combo → action, for the key handler. The first action wins if something still conflicts. */
export function keymap(bindings: Record<ShortcutAction, string[]>): Map<string, ShortcutAction> {
  const map = new Map<string, ShortcutAction>();
  for (const def of SHORTCUT_DEFS) for (const k of bindings[def.id]) if (!map.has(k)) map.set(k, def.id);
  return map;
}
