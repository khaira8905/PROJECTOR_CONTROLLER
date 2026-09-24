import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PanelProps {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** A titled card used for every dashboard section. */
export function Panel({ title, icon, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn('flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-console-900 shadow-lg shadow-black/20', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            {icon}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
