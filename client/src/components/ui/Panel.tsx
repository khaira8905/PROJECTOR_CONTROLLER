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
    <section className={cn('ec-card flex min-h-0 flex-col rounded-lg', className)}>
      {(title || actions) && (
        <header className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
          <h2 className="flex min-w-0 items-center gap-2.5 text-[17px] font-semibold tracking-[-0.01em] text-white">
            {icon && (
              <span className="shrink-0 text-slate-300" aria-hidden>
                {icon}
              </span>
            )}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 px-4 pb-3.5', bodyClassName)}>{children}</div>
    </section>
  );
}
