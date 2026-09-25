import { useEffect, useState, type FormEvent } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw, Settings2, Timer } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { formatClock, parseClock } from '../../lib/format';
import { RollingClock, RollingDigits } from '../display/motion';
import { Segmented } from '../ui/Segmented';
import { timerTone } from '../../lib/timer';
import { Switch } from '../ui/Switch';
import { cn } from '../../lib/cn';
import type { ControlCommand, TimerSnapshot } from '../../types';

interface TimerPanelProps {
  timer: TimerSnapshot | null;
  remaining: number;
  /** How long a finished countdown has been over time. */
  overtime?: number;
  send: (cmd: ControlCommand) => void;
  className?: string;
}

const PRESETS = [5, 10, 15, 20, 30];

type TimerMode = 'countdown' | 'clock';

export function TimerPanel({ timer, remaining, overtime = 0, send, className }: TimerPanelProps) {
  const [editing, setEditing] = useState(false);
  const [duration, setDuration] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<TimerMode>('countdown');
  const now = useNow(mode === 'clock');

  useEffect(() => {
    if (timer && !editing) {
      setDuration(formatClock(timer.durationMs));
      setWarning(formatClock(timer.warningMs));
    }
  }, [timer?.durationMs, timer?.warningMs, editing]);

  if (!timer) {
    return (
      <Panel title="Timer" icon={<Timer size={20} />} className={className}>
        <div className="h-32 animate-pulse rounded-lg bg-console-850" />
      </Panel>
    );
  }

  const tone = timerTone(timer, remaining);
  const running = timer.status === 'running';
  const over = timer.status === 'finished' && overtime >= 1000;
  const progress = timer.durationMs > 0 ? Math.min(1, remaining / timer.durationMs) : 0;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const d = parseClock(duration);
    const w = parseClock(warning);
    if (!d || d < 1000) return setError('Enter a duration like 10:00.');
    if (w === null) return setError('Enter a warning like 02:00.');
    send({ type: 'timer-configure', durationMs: d, warningMs: w });
    setError(null);
    setEditing(false);
  };

  const caption =
    mode === 'clock'
      ? now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
      : over
        ? 'Over time'
        : tone === 'finished'
          ? "Time's up"
          : timer.status === 'paused'
            ? 'Paused'
            : running
              ? timer.showOnDisplay
                ? 'Session resumes in · on the projector'
                : 'Time remaining'
              : `Countdown · ${formatClock(timer.durationMs)}`;

  return (
    <Panel
      title="Timer"
      icon={<Timer size={20} />}
      className={className}
      actions={
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            className="rounded-md border border-[var(--line)] p-0.5 [&_button]:py-0.5 [&_button]:text-[12px] [&_button]:font-medium [&_button]:tracking-normal [&_button]:normal-case"
            options={[
              { value: 'countdown', label: 'Countdown' },
              { value: 'clock', label: 'Clock' },
            ]}
          />
          <Button size="icon-sm" variant="ghost" aria-label="Timer settings" title="Duration & warning" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
            <Settings2 size={15} />
          </Button>
        </>
      }
    >
      <div
        className={cn(
          'ec-timer-readout text-center font-mono text-[56px] leading-[1.1] font-bold tracking-tight tabular-nums transition-colors duration-300',
          mode === 'clock' ? 'text-white' : over || tone === 'finished' ? 'text-red-400' : tone === 'warning' ? 'text-amber-400' : tone === 'idle' ? 'text-slate-300' : 'text-white',
          over && 'ec-overtime',
        )}
        aria-live="off"
      >
        {mode === 'clock' ? (
          <RollingDigits text={now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} live />
        ) : over ? (
          <RollingDigits text={`+${formatClock(overtime)}`} />
        ) : (
          <RollingClock ms={remaining} live={running} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className={cn('min-w-0 truncate text-[13px]', over ? 'font-medium text-red-400' : 'text-slate-500')}>{caption}</p>
        {mode === 'countdown' && (
          <Switch
            compact
            label="On display"
            checked={timer.showOnDisplay}
            onChange={(v) => send({ type: 'timer-configure', showOnDisplay: v })}
          />
        )}
      </div>
      {mode === 'countdown' && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-console-600">
          <div
            className={cn('h-full rounded-full transition-[width,background-color] duration-300 ease-linear', over || tone === 'finished' ? 'bg-red-500' : tone === 'warning' ? 'bg-amber-400' : 'bg-sky-500')}
            style={{ width: `${over ? 100 : progress * 100}%` }}
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2 [&>button]:min-w-0 [&>button]:gap-1 [&>button]:px-1.5">
        <Button
          variant={running ? 'warning' : 'primary'}
          className="h-10"
          icon={running ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          onClick={() => send({ type: running ? 'timer-pause' : 'timer-start' })}
          title="Start / pause (P)"
        >
          {running ? 'Pause' : timer.status === 'paused' ? 'Resume' : over || tone === 'finished' ? 'Restart' : 'Start'}
        </Button>
        <Button className="h-10 px-2" icon={<RotateCcw size={15} />} onClick={() => send({ type: 'timer-reset' })} title="Reset (R)">
          Reset
        </Button>
        <Button className="h-10 px-2" icon={<Minus size={14} />} onClick={() => send({ type: 'timer-adjust', deltaMs: -60_000 })} aria-label="Remove one minute">
          1 min
        </Button>
        <Button className="h-10 px-2" icon={<Plus size={14} />} onClick={() => send({ type: 'timer-adjust', deltaMs: 60_000 })} aria-label="Add one minute">
          1 min
        </Button>
      </div>


      {editing && (
        <form onSubmit={save} className="ec-rise-in mt-3 space-y-3 rounded-lg border border-[var(--line)] bg-console-850 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Duration
              <TextInput value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="10:00" className="mt-1 font-mono" />
            </label>
            <label className="text-xs text-slate-400">
              Warning threshold
              <TextInput value={warning} onChange={(e) => setWarning(e.target.value)} placeholder="02:00" className="mt-1 font-mono" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((m) => (
              <button key={m} type="button" className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={() => setDuration(formatClock(m * 60_000))}>
                {m} min
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" type="submit">
              Apply
            </Button>
          </div>
          {running && <p className="text-[11px] text-slate-500">A new duration applies after the running timer is reset.</p>}
        </form>
      )}
    </Panel>
  );
}

/** The current time, updated every second while `active`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}
