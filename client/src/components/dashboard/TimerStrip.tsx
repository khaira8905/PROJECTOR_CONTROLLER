import { useContext, useState } from 'react';
import { Minus, Monitor, MonitorOff, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { RollingClock, RollingDigits } from '../display/motion';
import { ClockOffsetContext, useLiveRemaining } from '../../hooks/useLiveRemaining';
import { cn } from '../../lib/cn';
import { formatClock } from '../../lib/format';
import { timerOvertime, timerTone } from '../../lib/timer';
import type { ControlCommand, TimerSnapshot } from '../../types';

type DockState = 'ready' | 'running' | 'warning' | 'paused' | 'done';

const STATE_LABEL: Record<DockState, string> = {
  ready: 'Ready',
  running: 'Running',
  warning: 'Almost up',
  paused: 'Paused',
  done: 'Time’s up',
};

/**
 * The countdown, docked under the Flow: one row that reads at a glance. The state is
 * carried by a small label, the colour of the readout and a hairline of progress along
 * the top edge. When time is up it keeps counting the overtime (the audience sees 00:00).
 */
export function TimerStrip({ timer, send, onMore, className }: { timer: TimerSnapshot | null; send: (cmd: ControlCommand) => void; onMore: () => void; className?: string }) {
  const remaining = useLiveRemaining(timer);
  const offset = useContext(ClockOffsetContext);
  const [spin, setSpin] = useState(0);
  if (!timer) return null;

  const tone = timerTone(timer, remaining);
  const running = timer.status === 'running';
  const overtime = timerOvertime(timer, offset);
  const over = timer.status === 'finished' && overtime >= 1000;
  const state: DockState = over || tone === 'finished' ? 'done' : timer.status === 'paused' ? 'paused' : running ? (tone === 'warning' ? 'warning' : 'running') : 'ready';
  const progress = timer.durationMs > 0 ? Math.min(1, remaining / timer.durationMs) : 0;

  return (
    <section aria-label="Timer" className={cn('ec-timer-dock relative shrink-0', className)} data-state={state}>
      <span className="ec-timer-progress" style={{ transform: `scaleX(${state === 'done' ? 1 : state === 'ready' ? 1 : progress})` }} aria-hidden />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 max-sm:px-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="leading-none">
            <p className="ec-timer-state flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] uppercase" role="status" aria-live="polite">
              <span className="ec-timer-dot h-1.5 w-1.5 rounded-full" aria-hidden />
              <span key={state} className="ec-text-swap">
                {STATE_LABEL[state]}
              </span>
            </p>
            <div className={cn('ec-timer-readout t-num mt-1 text-[36px] leading-none', over && 'ec-overtime')} title={over ? 'Over time' : undefined}>
              {over ? <RollingDigits text={`+${formatClock(overtime)}`} /> : <RollingClock ms={remaining} live={running} />}
            </div>
          </div>
          <button onClick={onMore} className="ec-link self-end pb-0.5 text-[12px] font-medium whitespace-nowrap text-slate-500" title="Change the duration, warning and clock in Timers">
            of {formatClock(timer.durationMs)}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="ec-toolbar ec-toolbar-sm flex" role="toolbar" aria-label="Timer controls">
            <button
              className={cn('ec-tb-btn min-w-[6.25rem] justify-center', !running && 'ec-tb-primary')}
              onClick={() => send({ type: running ? 'timer-pause' : 'timer-start' })}
              title="Start or pause (P)"
            >
              <span key={running ? 'pause' : 'play'} className="ec-icon-swap flex">
                {running ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </span>
              {running ? 'Pause' : timer.status === 'paused' ? 'Resume' : state === 'done' ? 'Restart' : 'Start'}
            </button>
            <button
              className="ec-tb-btn justify-center !px-2.5"
              onClick={() => {
                setSpin((n) => n + 1);
                send({ type: 'timer-reset' });
              }}
              aria-label="Reset timer"
              title="Reset (R)"
            >
              <RotateCcw key={spin} size={15} className={spin ? 'ec-spin-back' : undefined} />
            </button>
            <button className="ec-tb-btn justify-center !px-2.5" onClick={() => send({ type: 'timer-adjust', deltaMs: -60_000 })} aria-label="One minute less" title="One minute less">
              <Minus size={15} />
            </button>
            <button className="ec-tb-btn justify-center !px-2.5" onClick={() => send({ type: 'timer-adjust', deltaMs: 60_000 })} aria-label="One minute more" title="One minute more">
              <Plus size={15} />
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={timer.showOnDisplay}
            onClick={() => send({ type: 'timer-configure', showOnDisplay: !timer.showOnDisplay })}
            aria-label={timer.showOnDisplay ? 'Shown on the projector — click to hide' : 'Hidden from the projector — click to show'}
            title={timer.showOnDisplay ? 'Shown on the projector (click to hide)' : 'Hidden from the projector (click to show)'}
          >
            {timer.showOnDisplay ? <Monitor size={17} /> : <MonitorOff size={17} />}
          </Button>
        </div>
      </div>
    </section>
  );
}
