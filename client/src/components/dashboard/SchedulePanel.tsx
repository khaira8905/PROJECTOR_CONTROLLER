import { useState, type FormEvent } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { useNow } from '../../hooks/useNow';
import { scheduleStatus } from '../../lib/schedule';
import { cn } from '../../lib/cn';
import type { ScheduleItem } from '../../types';

interface SchedulePanelProps {
  schedule: ScheduleItem[];
  onAdd: (item: { time: string; title: string }) => Promise<void>;
  onDelete: (item: ScheduleItem) => void;
  className?: string;
  /** Render without its own card (e.g. inside a tabbed panel). */
  embedded?: boolean;
}

/** Operator reference: which session is on now, which is next, and what's coming. */
export function SchedulePanel({ schedule, onAdd, onDelete, className, embedded }: SchedulePanelProps) {
  const now = useNow(15_000);
  const status = scheduleStatus(schedule, now);
  const [adding, setAdding] = useState(false);
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{2}:\d{2}$/.test(time)) return setError('Pick a time.');
    if (!title.trim()) return setError('Enter a title.');
    try {
      await onAdd({ time, title: title.trim() });
      setTitle('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add item.');
    }
  };

  const actions = (
        <>
          <span className="font-mono text-xs text-slate-400 tabular-nums">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Add schedule item" onClick={() => setAdding((a) => !a)}>
            <Plus size={15} />
          </Button>
        </>
  );
  const content = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-500/[0.07] p-3 ring-1 ring-emerald-500/20">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-emerald-300 uppercase">Now</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{status.current?.title ?? '—'}</p>
          <p className="font-mono text-xs text-slate-500">{status.current?.time ?? ''}</p>
        </div>
        <div className="rounded-xl bg-console-850 p-3 ring-1 ring-white/[0.06]">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-sky-300 uppercase">Next</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{status.next?.title ?? '—'}</p>
          <p className="font-mono text-xs text-slate-500">
            {status.next ? `${status.next.time}${status.minutesUntilNext !== null ? ` · in ${status.minutesUntilNext} min` : ''}` : ''}
          </p>
        </div>
      </div>

      {adding && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28 font-mono" aria-label="Time" />
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" maxLength={200} aria-label="Title" />
          <Button type="submit" variant="primary" size="icon" aria-label="Add">
            <Plus size={16} />
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {schedule.length === 0 ? (
        <p className="mt-4 text-center text-sm text-slate-500">No schedule yet. Use + to add sessions.</p>
      ) : (
        <ol className="mt-3 space-y-0.5">
          {status.sorted.map((item, i) => {
            const isCurrent = i === status.currentIndex;
            const isPast = status.currentIndex >= 0 ? i < status.currentIndex : false;
            return (
              <li
                key={item.id}
                className={cn('group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm', isCurrent ? 'bg-emerald-500/10 text-white' : isPast ? 'text-slate-600' : 'text-slate-300')}
              >
                <span className={cn('font-mono text-xs tabular-nums', isCurrent ? 'text-emerald-300' : 'text-slate-500')}>{item.time}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <button
                  onClick={() => onDelete(item)}
                  className="rounded p-1 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-300 focus:opacity-100"
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
  if (embedded) {
    return (
      <div className="flex flex-col">
        <div className="mb-2 flex items-center justify-end gap-2">{actions}</div>
        {content}
      </div>
    );
  }
  return (
    <Panel title="Schedule" icon={<CalendarClock size={14} />} className={className} bodyClassName="scroll-thin overflow-y-auto" actions={actions}>
      {content}
    </Panel>
  );
}
