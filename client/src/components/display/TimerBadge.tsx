import { formatClock } from '../../lib/format';
import { timerTone } from '../../lib/timer';
import { cn } from '../../lib/cn';
import type { TimerSnapshot } from '../../types';

/** Countdown shown on the audience display (only when enabled by the operator). */
export function TimerBadge({ timer, remaining, large }: { timer: TimerSnapshot; remaining: number; large?: boolean }) {
  const tone = timerTone(timer, remaining);
  return (
    <div
      className={cn(
        'rounded-[1.2cqw] font-mono font-bold tabular-nums shadow-2xl ring-1',
        large ? 'px-[2cqw] py-[0.6cqw] text-[8cqw]' : 'px-[1.4cqw] py-[0.4cqw] text-[3.4cqw]',
        tone === 'finished'
          ? 'animate-pulse-soft bg-red-600/90 text-white ring-red-300/40'
          : tone === 'warning'
            ? 'bg-amber-400/90 text-amber-950 ring-amber-200/40'
            : 'bg-black/70 text-white ring-white/15',
      )}
    >
      {tone === 'finished' ? 'TIME' : formatClock(remaining)}
    </div>
  );
}
