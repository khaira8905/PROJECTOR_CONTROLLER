export type ThemeId = 'aurora' | 'ember' | 'ocean';

export const THEMES: { id: ThemeId; name: string; note: string; swatch: [string, string, string] }[] = [
  { id: 'aurora', name: 'Aurora', note: 'Ink violet, lilac glow', swatch: ['#110e19', '#8f67fb', '#e07bf5'] },
  { id: 'ember', name: 'Ember', note: 'Warm graphite, copper', swatch: ['#13100d', '#f97a1f', '#fcd34d'] },
  { id: 'ocean', name: 'Ocean', note: 'Midnight blue, the classic', swatch: ['#0b0f17', '#0ea5e9', '#8b5cf6'] },
];

const KEY = 'ec-theme';
const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function storedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (isTheme(v)) return v;
  } catch {
    /* storage blocked: fall back to the default */
  }
  return 'aurora';
}

/** Applies a theme to the page (and remembers it in this browser). */
export function applyTheme(id: ThemeId, persist = true) {
  document.documentElement.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', THEMES.find((t) => t.id === id)!.swatch[0]);
  if (!persist) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* not critical */
  }
}
