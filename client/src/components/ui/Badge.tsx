import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'live' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

const tones: Record<Tone, string> = {
  neutral: 'bg-white/5 text-slate-300 ring-white/10',
  live: 'bg-red-500/15 text-red-300 ring-red-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  danger: 'bg-red-500/15 text-red-300 ring-red-500/30',
  info: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] uppercase ring-1 ring-inset', tones[tone], className)}>
      {dot && tone === 'live' ? <LiveBars /> : dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Three little bars bouncing like an audio meter: "this is on air right now". */
export function LiveBars({ className }: { className?: string }) {
  return (
    <span className={cn('ec-eq inline-flex h-2.5 items-end gap-[2px]', className)} aria-hidden>
      <span className="h-full w-[2px] rounded-full bg-current" />
      <span className="h-full w-[2px] rounded-full bg-current" />
      <span className="h-full w-[2px] rounded-full bg-current" />
    </span>
  );
}
