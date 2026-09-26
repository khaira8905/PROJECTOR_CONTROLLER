import { useEffect, useMemo, useRef } from 'react';
import { comboFromEvent, keymap, type ShortcutAction } from '../lib/shortcuts';

export type ShortcutHandlers = Partial<Record<ShortcutAction, (e: KeyboardEvent) => void>>;

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.closest?.('[data-capture-keys]')) return true; // the shortcut editor is recording a key
  if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Global presenter shortcuts. `bindings` says which keys trigger which action (see
 * lib/shortcuts); `handlers` says what the actions do. Ignored while typing or while a
 * dialog is open, and a held key never repeats (it must not skip through slides).
 */
export function useKeyboardShortcuts(bindings: Record<ShortcutAction, string[]>, handlers: ShortcutHandlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const map = useMemo(() => keymap(bindings), [bindings]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const combo = comboFromEvent(e);
      const action = combo ? map.get(combo) : undefined;
      const handler = action ? handlersRef.current[action] : undefined;
      if (!handler) return;
      // Don't let Space/Arrows scroll the page or re-trigger a focused button.
      e.preventDefault();
      if (e.repeat) return;
      handler(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, map]);
}
