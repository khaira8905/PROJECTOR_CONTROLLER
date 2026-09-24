import { useEffect, useState, type FormEvent } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw, Settings2, Timer } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Kbd } from '../ui/Kbd';
import { TextInput } from '../ui/Field';
import { formatClock, parseClock } from '../../lib/format';
import { timerTone } from '../../lib/timer';
import { cn } from '../../lib/cn';
import type { ControlCommand, TimerSnapshot } from '../../types';

interface TimerPanelProps {
  timer: TimerSnapshot | null;
  remaining: number;
  send: (cmd: ControlCommand) => void;
  className?: string;
}

const PRESETS = [5, 10, 15, 20, 30];

export function TimerPanel({ timer, remaining, send, className }: TimerPanelProps) {
  const [editing, setEditing] = useState(false);
  const [duration, setDuration] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (timer && !editing) {
      setDuration(formatClock(timer.durationMs));
      setWarning(formatClock(timer.warningMs));
    }
  }, [timer?.durationMs, timer?.warningMs, editing]);

  if (!timer) {
    return (
      <Panel title="Timer" icon={<Timer size={14} />} className={className}>
        <div className="h-32 animate-pulse rounded-xl bg-console-850" />
      </Panel>
    );
  }

  const tone = timerTone(timer, remaining);
  const running = timer.status === 'running';
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

  return (
    <Panel
      title="Timer"
      icon={<Timer size={14} />}
      className={className}
      actions={
        <>
          <Badge tone={running ? 'success' : tone === 'finished' ? 'danger' : timer.status === 'paused' ? 'warning' : 'neutral'} dot={running}>
            {tone === 'finished' ? "Time's up" : timer.status}
          </Badge>
          <Button size="icon-sm" variant="ghost" aria-label="Timer settings" onClick={() => setEditing((v) => !v)}>
            <Settings2 size={15} />
          </Button>
        </>
      }
    >
      <div
        className={cn(
          'rounded-xl py-3 text-center font-mono text-6xl font-bold tracking-tight tabular-nums transition-colors',
          tone === 'finished' ? 'animate-pulse-soft bg-red-500/10 text-red-400' : tone === 'warning' ? 'bg-amber-400/10 text-amber-300' : tone === 'idle' ? 'text-slate-300' : 'text-white',
        )}
        aria-live="off"
      >
        {formatClock(remaining)}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={cn('h-full rounded-full', tone === 'warning' ? 'bg-amber-400' : tone === 'finished' ? 'bg-red-500' : 'bg-sky-400')}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
        <span>of {formatClock(timer.durationMs)}</span>
        <span>warning at {formatClock(timer.warningMs)}</span>
      </div>

      <Button
        variant={running ? 'warning' : 'success'}
        size="lg"
        className="mt-3 h-12 w-full"
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        onClick={() => send({ type: running ? 'timer-pause' : 'timer-start' })}
      >
        {running ? 'Pause' : timer.status === 'paused' ? 'Resume' : 'Start'} <Kbd className="ml-1 border-black/20 bg-black/10 text-current">Space</Kbd>
      </Button>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button icon={<RotateCcw size={15} />} onClick={() => send({ type: 'timer-reset' })}>
          Reset
        </Button>
        <Button icon={<Minus size={14} />} onClick={() => send({ type: 'timer-adjust', deltaMs: -60_000 })} aria-label="Remove one minute">
          1 min
        </Button>
        <Button icon={<Plus size={14} />} onClick={() => send({ type: 'timer-adjust', deltaMs: 60_000 })} aria-label="Add one minute">
          1 min
        </Button>
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg bg-console-850 px-3 py-2 text-sm">
        <span className="text-slate-300">Show timer on display</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-sky-400"
          checked={timer.showOnDisplay}
          onChange={(e) => send({ type: 'timer-configure', showOnDisplay: e.target.checked })}
        />
      </label>

      {editing && (
        <form onSubmit={save} className="mt-3 space-y-3 rounded-lg border border-white/[0.06] bg-console-850 p-3">
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
