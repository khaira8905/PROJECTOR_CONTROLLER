import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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
}

export const DEFAULT_UI_PREFS: UiPrefs = { density: 'comfortable', motion: 'full', showPreview: true, showSlides: true, presenterMode: false };

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

/** Called before the first paint. */
export function applyStoredUiPrefs() {
  applyUiPrefs(read());
}
