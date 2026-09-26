import { useContext } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { RollingClock, RollingDigits } from '../display/motion';
import { ClockOffsetContext, useLiveRemaining } from '../../hooks/useLiveRemaining';
import { cn } from '../../lib/cn';
import { formatClock } from '../../lib/format';
import { timerOvertime, timerTone } from '../../lib/timer';
import type { ControlCommand, TimerSnapshot } from '../../types';

/**
 * The countdown in one line for the Control view: time, start/pause, reset and ±1 min.
 * When time is up it keeps counting the overtime in red (the audience still sees 00:00).
 */
export function TimerStrip({ timer, send, onMore }: { timer: TimerSnapshot | null; send: (cmd: ControlCommand) => void; onMore: () => void }) {
  const remaining = useLiveRemaining(timer);
  const offset = useContext(ClockOffsetContext);
  if (!timer) return null;
  const tone = timerTone(timer, remaining);
  const running = timer.status === 'running';
  const overtime = timerOvertime(timer, offset);
  const over = timer.status === 'finished' && overtime >= 1000;
  const progress = timer.durationMs > 0 ? Math.min(1, remaining / timer.durationMs) : 0;

  return (
    <section aria-label="Timer">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="ec-label">Timer</h3>
        <button onClick={onMore} className="text-[12px] font-medium text-slate-500 hover:text-white">
          {formatClock(timer.durationMs)} countdown · change
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'ec-timer-readout w-[7.5rem] shrink-0 font-mono text-[34px] leading-none font-bold tracking-tight tabular-nums',
            over || tone === 'finished' ? 'text-red-400' : tone === 'warning' ? 'text-amber-400' : tone === 'idle' ? 'text-slate-400' : 'text-white',
            over && 'ec-overtime',
          )}
          title={over ? 'Over time' : undefined}
        >
          {over ? <RollingDigits text={`+${formatClock(overtime)}`} /> : <RollingClock ms={remaining} live={running} />}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          <Button
            variant={running ? 'warning' : 'secondary'}
            className="h-10 min-w-[6.5rem]"
            icon={running ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
            onClick={() => send({ type: running ? 'timer-pause' : 'timer-start' })}
            title="Start or pause (P)"
          >
            {running ? 'Pause' : timer.status === 'paused' ? 'Resume' : over || tone === 'finished' ? 'Restart' : 'Start'}
          </Button>
          <Button variant="secondary" size="icon" onClick={() => send({ type: 'timer-reset' })} aria-label="Reset timer" title="Reset (R)">
            <RotateCcw size={15} />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => send({ type: 'timer-adjust', deltaMs: -60_000 })} aria-label="One minute less" title="One minute less">
            <Minus size={15} />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => send({ type: 'timer-adjust', deltaMs: 60_000 })} aria-label="One minute more" title="One minute more">
            <Plus size={15} />
          </Button>
        </div>
      </div>
      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-console-600">
        <div
          className={cn('h-full transition-[width,background-color] duration-300 ease-linear', over || tone === 'finished' ? 'bg-red-500' : tone === 'warning' ? 'bg-amber-400' : 'bg-sky-500')}
          style={{ width: `${over ? 100 : progress * 100}%` }}
        />
      </div>
      <Switch compact className="mt-2" label={over ? 'Over time · the projector shows 00:00' : 'Show on the projector'} checked={timer.showOnDisplay} onChange={(v) => send({ type: 'timer-configure', showOnDisplay: v })} />
    </section>
  );
}
