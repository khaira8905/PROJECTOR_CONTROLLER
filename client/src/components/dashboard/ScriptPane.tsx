import { useEffect, useRef } from 'react';
import { AArrowDown, AArrowUp, Pencil, ScrollText } from 'lucide-react';
import { Button } from '../ui/Button';
import { itemLabel } from '../../lib/flow';
import { cn } from '../../lib/cn';
import type { QueueItem } from '../../types';

const SIZES = ['md', 'lg', 'xl'] as const;
type Size = (typeof SIZES)[number];
const SIZE_CLASS: Record<Size, string> = {
  md: 'text-[17px] leading-[1.65]',
  lg: 'text-[21px] leading-[1.6]',
  xl: 'text-[26px] leading-[1.55]',
};

/**
 * The script layout's main reading area: the script of the item on screen, large and calm,
 * with the next item's opening line underneath so the presenter knows what's coming.
 * Operator-only — scripts never reach the audience display.
 */
export function ScriptPane({
  item,
  next,
  size,
  onSize,
  onEdit,
  className,
}: {
  item: QueueItem | null;
  next: QueueItem | null;
  size: Size;
  onSize: (s: Size) => void;
  onEdit: (item: QueueItem) => void;
  className?: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  // A new item starts reading from the top.
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [item?.id]);

  const i = SIZES.indexOf(size);
  const nextLine = next?.script.trim().split('\n').find((l) => l.trim()) ?? '';

  return (
    <section className={cn('ec-script flex min-h-0 flex-col', className)} aria-label="Script">
      <header className="ec-flow-head flex items-center gap-2 border-b ec-line">
        <div className="min-w-0 flex-1">
          <h2 className="t-section flex items-center gap-2 text-[19px]">
            <ScrollText size={18} className="text-slate-400" /> Script
          </h2>
          <p key={item?.id ?? 'none'} className="t-support ec-text-swap mt-0.5 truncate">
            {item ? itemLabel(item) : 'Nothing from the Flow on screen yet'}
          </p>
        </div>
        <span className="ec-button-group flex" role="group" aria-label="Text size">
          <Button size="icon-sm" variant="secondary" onClick={() => onSize(SIZES[Math.max(0, i - 1)])} disabled={i === 0} aria-label="Smaller text" title="Smaller text">
            <AArrowDown size={16} />
          </Button>
          <Button size="icon-sm" variant="secondary" onClick={() => onSize(SIZES[Math.min(SIZES.length - 1, i + 1)])} disabled={i === SIZES.length - 1} aria-label="Larger text" title="Larger text">
            <AArrowUp size={16} />
          </Button>
        </span>
        {item && (
          <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => onEdit(item)}>
            Edit
          </Button>
        )}
      </header>

      <div ref={body} className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--gutter)] py-5">
        {item?.script.trim() ? (
          <article key={item.id} className={cn('ec-text-swap max-w-[68ch] whitespace-pre-wrap text-slate-100', SIZE_CLASS[size])}>
            {item.script}
          </article>
        ) : (
          <div className="flex h-full min-h-[8rem] flex-col items-start justify-center gap-3">
            <p className="text-[15px] text-slate-400">{item ? `No script for “${itemLabel(item)}” yet.` : 'Start the show to see the script of the item on screen here.'}</p>
            {item && (
              <Button size="sm" icon={<Pencil size={14} />} onClick={() => onEdit(item)}>
                Write the script
              </Button>
            )}
          </div>
        )}
      </div>

      {next && (
        <footer className="ec-script-next flex items-baseline gap-2 border-t ec-line px-[var(--gutter)] py-2.5 text-[13px]">
          <span className="ec-label shrink-0">Next</span>
          <span className="shrink-0 font-semibold text-slate-200">{itemLabel(next)}</span>
          {nextLine && <span className="min-w-0 truncate text-slate-500">— {nextLine}</span>}
        </footer>
      )}
    </section>
  );
}
