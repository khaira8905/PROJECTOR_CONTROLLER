import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/Button';
import { THEMES, applyTheme, storedTheme, type ThemeId } from '../lib/theme';
import { cn } from '../lib/cn';

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown };

/** Switches the console between the White and Blue themes, remembered in this browser. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(storedTheme);
  const choose = (id: ThemeId) => {
    setTheme(id);
    const doc = document as ViewTransitionDoc;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Cross-fade into the new colours where the browser supports it.
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => applyTheme(id));
    else applyTheme(id);
  };
  return { theme, choose };
}

/** A single button in the top bar: the sun/moon shows what you switch to. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, choose } = useTheme();
  const other = THEMES.find((t) => t.id !== theme)!;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => choose(other.id)}
      aria-label={`Switch to the ${other.name} theme`}
      title={`Switch to the ${other.name} theme`}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
  );
}

/** Theme cards for the Settings page. */
export function ThemePicker() {
  const { theme, choose } = useTheme();
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Console theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          onClick={() => choose(t.id)}
          className={cn(
            'rounded-lg border p-3 text-left transition-[border-color,box-shadow] duration-150',
            theme === t.id ? 'border-sky-500 shadow-[0_0_0_1px_var(--accent-500)]' : 'border-[var(--line-strong)] hover:border-sky-400',
          )}
        >
          {/* A tiny drawing of the console in that theme. */}
          <span className="flex h-20 overflow-hidden rounded-md border border-[var(--line)]" style={{ background: t.swatch[0] }} aria-hidden>
            <span className="w-1/4" style={{ background: t.id === 'light' ? '#152646' : '#0a1120' }} />
            <span className="flex flex-1 flex-col gap-1.5 p-2">
              <span className="h-2 w-2/3 rounded-sm" style={{ background: t.swatch[1] }} />
              <span className="flex flex-1 gap-1.5">
                <span className="flex-[2] rounded-sm" style={{ background: t.swatch[1] }} />
                <span className="flex flex-1 flex-col gap-1">
                  <span className="h-3 rounded-sm" style={{ background: t.swatch[2] }} />
                  <span className="flex-1 rounded-sm" style={{ background: t.swatch[1] }} />
                </span>
              </span>
            </span>
          </span>
          <span className="mt-2.5 flex items-center justify-between">
            <span>
              <span className="block text-sm font-semibold text-white">{t.name}</span>
              <span className="block text-xs text-slate-500">{t.note}</span>
            </span>
            <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', theme === t.id ? 'border-sky-500' : 'border-[var(--line-strong)]')}>
              {theme === t.id && <span className="ec-pop h-2 w-2 rounded-full bg-sky-500" />}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
