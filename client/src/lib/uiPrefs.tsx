import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { effectiveBindings, type ShortcutOverrides } from './shortcuts';

/**
 * How the console looks on this computer. Kept in the browser (not the event), because
 * a laptop at the lectern and a big control-room monitor want different set-ups.
 */
export interface UiPrefs {
  density: 'comfortable' | 'compact';
  motion: 'full' | 'reduced' | 'off';
  /** Show the live picture of the projector in the Control view. */
  showPreview: boolean;
  /** Show slide thumbnails for the item on screen. */
  showSlides: boolean;
  /** Presenter mode: hides everything except Flow, the picture and the transport. */
  presenterMode: boolean;
  /** Keyboard shortcuts on/off, and the keys the operator changed (see lib/shortcuts). */
  keyboard: boolean;
  shortcuts: ShortcutOverrides;
  /** Scroll over the projector picture to change slides; click it for the next one. */
  mouseControls: boolean;
  /** Small key hints on buttons (B, W, Esc…). */
  hints: boolean;
  /** Size of the slide thumbnails under the item on screen. */
  thumbSize: 'small' | 'medium' | 'large';
  /** Keep the item on screen scrolled into view in the Flow. */
  followLive: boolean;
  /** Detailed rows (picture and details) or a compact list. */
  flowLayout: 'detailed' | 'compact';
  /** Show a Flow item as soon as it is clicked, or only on double-click / Enter (safer). */
  flowActivation: 'click' | 'double';
  /** Control view: Flow on the left (default), or the script on the left and the Flow on the right. */
  controlLayout: 'flow' | 'script';
  /** Reading size of the script. */
  scriptSize: 'md' | 'lg' | 'xl';
}

export const DEFAULT_UI_PREFS: UiPrefs = {
  density: 'comfortable',
  motion: 'full',
  showPreview: true,
  showSlides: true,
  presenterMode: false,
  keyboard: true,
  shortcuts: {},
  mouseControls: false,
  hints: true,
  thumbSize: 'medium',
  followLive: true,
  flowLayout: 'detailed',
  flowActivation: 'click',
  controlLayout: 'flow',
  scriptSize: 'lg',
};

const KEY = 'ec-ui-prefs';

function read(): UiPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...DEFAULT_UI_PREFS, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

/** Mirrors the preferences onto <html> so plain CSS can react (styles/console.css). */
export function applyUiPrefs(p: UiPrefs) {
  const root = document.documentElement;
  root.dataset.density = p.density;
  root.dataset.motion = p.motion;
  root.dataset.hints = p.hints ? 'on' : 'off';
}

const Ctx = createContext<{ prefs: UiPrefs; set: (patch: Partial<UiPrefs>) => void }>({ prefs: DEFAULT_UI_PREFS, set: () => {} });

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPrefs>(read);
  useEffect(() => applyUiPrefs(prefs), [prefs]);
  // Another tab changed them: follow along.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === KEY && setPrefs(read());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const set = useCallback((patch: Partial<UiPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: the change still applies until reload */
      }
      return next;
    });
  }, []);
  return <Ctx.Provider value={{ prefs, set }}>{children}</Ctx.Provider>;
}

export const useUiPrefs = () => useContext(Ctx);

/** The shortcut keys in effect on this computer. */
export function useShortcutBindings() {
  const { prefs } = useUiPrefs();
  return useMemo(() => effectiveBindings(prefs.shortcuts), [prefs.shortcuts]);
}

/** Called before the first paint. */
export function applyStoredUiPrefs() {
  applyUiPrefs(read());
}
