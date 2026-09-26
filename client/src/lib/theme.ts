export type ThemeId = 'light' | 'blue';

export const THEMES: { id: ThemeId; name: string; note: string; swatch: [string, string, string] }[] = [
  { id: 'light', name: 'White', note: 'Bright rooms and daytime', swatch: ['#eef1f5', '#ffffff', '#1f5ad6'] },
  { id: 'blue', name: 'Blue', note: 'Dark hall, easy on the eyes', swatch: ['#0b1324', '#111b30', '#3b7cf0'] },
];

const KEY = 'ec-theme';
export const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function storedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (isTheme(v)) return v;
    // Earlier versions had dark-only themes: keep those operators on a dark console.
    if (v) return 'blue';
  } catch {
    /* storage blocked: fall back to the default */
  }
  return 'light';
}

/** Applies a theme to the page (and remembers it in this browser). */
export function applyTheme(id: ThemeId, persist = true) {
  document.documentElement.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', id === 'light' ? '#152646' : '#0a1120');
  if (!persist) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* not critical */
  }
  // The account sync saves it with the person's other settings.
  window.dispatchEvent(new CustomEvent('ec:theme', { detail: id }));
}
