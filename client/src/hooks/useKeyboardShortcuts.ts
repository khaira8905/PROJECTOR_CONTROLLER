import { useEffect, useRef } from 'react';

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Global keyboard shortcuts. Keys are matched against `KeyboardEvent.key`
 * (lower-cased for letters), e.g. " ", "ArrowRight", "b", "?".
 * Shortcuts are ignored while typing or while a modal dialog is open.
 */
export function useKeyboardShortcuts(map: ShortcutMap, enabled = true) {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const handler = mapRef.current[key];
      if (!handler) return;
      // Don't let Space/Arrows scroll the page or re-trigger a focused button.
      e.preventDefault();
      // Holding a key must never skip through several items.
      if (e.repeat) return;
      handler(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
