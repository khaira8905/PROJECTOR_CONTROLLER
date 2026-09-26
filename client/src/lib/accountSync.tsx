import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { applyTheme, isTheme, storedTheme, type ThemeId } from './theme';
import { useUiPrefs, type UiPrefs } from './uiPrefs';

/**
 * Keeps the console settings (theme, shortcuts, layout, density…) in the signed-in account,
 * so they follow the person to any computer. On sign-in the account's settings are applied;
 * afterwards every change is saved back, a moment after the last click. The browser keeps a
 * copy too, so the console looks right instantly even before the account answers.
 */
export function AccountSync() {
  const { prefs, set } = useUiPrefs();
  const [theme, setTheme] = useState<ThemeId>(storedTheme);
  const ready = useRef(false);
  const saved = useRef('');

  // Load once per sign-in.
  useEffect(() => {
    let cancelled = false;
    api.account().then(
      (account) => {
        if (cancelled) return;
        const p = account.preferences ?? {};
        const ui = p.ui && typeof p.ui === 'object' ? (p.ui as Partial<UiPrefs>) : null;
        if (ui) set(ui);
        if (isTheme(p.theme)) {
          applyTheme(p.theme);
          setTheme(p.theme);
        }
        // A new account starts from whatever this browser had: save that as its starting point.
        saved.current = ui ? JSON.stringify({ ui: { ...prefs, ...ui }, theme: isTheme(p.theme) ? p.theme : theme }) : '';
        ready.current = true;
      },
      () => {
        ready.current = true; // offline or accounts off: keep the browser's settings
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onTheme = (e: Event) => setTheme((e as CustomEvent<ThemeId>).detail);
    window.addEventListener('ec:theme', onTheme);
    return () => window.removeEventListener('ec:theme', onTheme);
  }, []);

  // Save changes (debounced).
  useEffect(() => {
    if (!ready.current) return;
    const payload = JSON.stringify({ ui: prefs, theme });
    if (payload === saved.current) return;
    const t = window.setTimeout(() => {
      saved.current = payload;
      api.saveAccountPreferences(JSON.parse(payload)).catch(() => {
        saved.current = ''; // try again on the next change
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, [prefs, theme]);

  return null;
}
