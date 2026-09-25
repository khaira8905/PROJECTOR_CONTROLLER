import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { Button } from './ui/Button';
import { THEMES, applyTheme, storedTheme, type ThemeId } from '../lib/theme';
import { cn } from '../lib/cn';

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown };

/** Picks the console's colour theme. The choice is remembered in this browser. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(storedTheme);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (id: ThemeId) => {
    setTheme(id);
    const doc = document as ViewTransitionDoc;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Cross-fade the whole console into the new colours where the browser supports it.
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => applyTheme(id));
    else applyTheme(id);
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <Button variant="ghost" size="sm" icon={<Palette size={15} />} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Colour theme">
        <span className="max-lg:hidden">Theme</span>
      </Button>
      {open && (
        <div role="menu" className="ec-card ec-card-raised ec-pop-in absolute right-0 z-40 mt-2 w-64 origin-top-right rounded-xl p-1.5">
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Console theme</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={theme === t.id}
              onClick={() => choose(t.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                theme === t.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
              )}
            >
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10" style={{ background: t.swatch[0] }} aria-hidden>
                <span className="absolute -right-2 -bottom-2 h-7 w-7 rounded-full blur-[2px]" style={{ background: t.swatch[1] }} />
                <span className="absolute top-1.5 left-1.5 h-3 w-3 rounded-full" style={{ background: t.swatch[2] }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{t.name}</span>
                <span className="block truncate text-xs text-slate-400">{t.note}</span>
              </span>
              {theme === t.id && <Check size={16} className="ec-pop text-sky-300" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
