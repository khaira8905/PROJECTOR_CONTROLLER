import { timerTone } from '../../lib/timer';
import { cn } from '../../lib/cn';
import type { TimerSnapshot } from '../../types';
import { RollingClock } from './motion';

/** Corner countdown over slides (only when the operator enables "Show timer on display"). */
export function TimerBadge({ timer, remaining }: { timer: TimerSnapshot; remaining: number }) {
  const tone = timerTone(timer, remaining);
  const fraction = timer.durationMs > 0 ? Math.max(0, Math.min(1, remaining / timer.durationMs)) : 0;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[1.1cqw] px-[1.5cqw] pt-[0.5cqw] pb-[0.7cqw] font-mono text-[3.3cqw] font-semibold tracking-[-0.02em] shadow-2xl ring-1 backdrop-blur-md',
        tone === 'finished'
          ? 'animate-pulse-soft bg-red-600/90 text-white ring-red-300/40'
          : tone === 'warning'
            ? 'bg-amber-400/90 text-amber-950 ring-amber-200/50'
            : 'bg-black/55 text-white ring-white/15',
      )}
    >
      <RollingClock ms={tone === 'finished' ? 0 : remaining} live={timer.status === 'running'} className="leading-none" />
      <div className="absolute inset-x-0 bottom-0 h-[0.35cqw] bg-black/20">
        <div className={cn('h-full transition-[width] duration-300 ease-linear', tone === 'warning' ? 'bg-amber-900/60' : 'bg-white/60')} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
