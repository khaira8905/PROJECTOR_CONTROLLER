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
    <section className={cn('ec-card flex min-h-0 flex-col rounded-2xl', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3">
          <h2 className="flex items-center gap-2.5 font-display text-[13px] font-semibold tracking-[0.06em] text-slate-200 uppercase">
            {icon && (
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20 ring-inset" aria-hidden>
                {icon}
              </span>
            )}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
