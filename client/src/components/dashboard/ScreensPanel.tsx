import { useEffect, useState, type FormEvent } from 'react';
import { ListPlus, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { cn } from '../../lib/cn';
import { formatClock, parseClock } from '../../lib/format';
import type { ScreenInput } from '../../services/api';
import type { DisplaySnapshot, Media, Screen, ScreenStyle } from '../../types';
import { ScreenDot } from './ShowFlowPanel';

interface Props {
  screens: Screen[];
  display: DisplaySnapshot | null;
  media: Media[];
  onShow: (screen: Screen, timerMs?: number) => void;
  onAddToFlow: (screen: Screen) => void;
  onSave: (screen: Screen | null, input: ScreenInput) => Promise<void>;
  onDelete: (screen: Screen) => void;
}

/** Special screens: one click puts them on the projector; ⏱ shows them with a countdown. */
export function ScreensPanel({ screens, display, media, onShow, onAddToFlow, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<Screen | 'new' | null>(null);
  const [timerFor, setTimerFor] = useState<Screen | null>(null);
  const liveId = display?.mode === 'screen' ? display.screen?.id : null;

  return (
    <div className="flex flex-col gap-2">
      <ul className="ec-stagger grid grid-cols-1 gap-1.5">
        {screens.map((s) => (
          <li
            key={s.id}
            className={cn(
              'group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-[border-color,background-color,translate] duration-300 ease-out',
              liveId === s.id
                ? 'border-red-500/40 bg-gradient-to-r from-red-500/[0.14] to-red-500/[0.03]'
                : 'border-white/[0.06] bg-white/[0.025] hover:translate-x-0.5 hover:border-white/15 hover:bg-white/[0.045]',
            )}
          >
            <ScreenDot style={s.style} />
            <button className="min-w-0 flex-1 text-left" onClick={() => onShow(s)} title="Show on display">
              <p className="truncate text-sm font-medium text-slate-100">{s.title}</p>
              <p className="truncate text-[11px] text-slate-500">{s.subtitle || (s.style === 'coming-up' ? 'Announces the next item automatically' : ' ')}</p>
            </button>
            {liveId === s.id && <span className="text-[10px] font-bold tracking-wider text-red-300 uppercase">Live</span>}
            <div className="flex items-center opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
              <Button size="icon-sm" variant="ghost" title="Show with countdown" aria-label={`Show ${s.title} with a countdown`} onClick={() => setTimerFor(s)}>
                <Timer size={14} />
              </Button>
              <Button size="icon-sm" variant="ghost" title="Add to show flow" aria-label={`Add ${s.title} to show flow`} onClick={() => onAddToFlow(s)}>
                <ListPlus size={14} />
              </Button>
              <Button size="icon-sm" variant="ghost" title="Edit" aria-label={`Edit ${s.title}`} onClick={() => setEditing(s)}>
                <Pencil size={14} />
              </Button>
              {!s.builtin && (
                <Button size="icon-sm" variant="ghost" title="Delete" aria-label={`Delete ${s.title}`} className="hover:text-red-300" onClick={() => onDelete(s)}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
        Custom screen
      </Button>
      <ScreenEditModal screen={editing} media={media} onClose={() => setEditing(null)} onSave={onSave} />
      <CountdownModal
        screen={timerFor}
        onClose={() => setTimerFor(null)}
        onStart={(ms) => {
          if (timerFor) onShow(timerFor, ms);
          setTimerFor(null);
        }}
      />
    </div>
  );
}

const STYLES: { value: ScreenStyle; label: string }[] = [
  { value: 'custom', label: 'Neutral' },
  { value: 'please-wait', label: 'Blue' },
  { value: 'starting', label: 'Sky' },
  { value: 'break', label: 'Teal' },
  { value: 'coming-up', label: 'Indigo' },
  { value: 'thanks', label: 'Violet' },
  { value: 'technical', label: 'Amber' },
];

function ScreenEditModal({ screen, media, onClose, onSave }: { screen: Screen | 'new' | null; media: Media[]; onClose: () => void; onSave: Props['onSave'] }) {
  const [form, setForm] = useState<ScreenInput>({ title: '', subtitle: '', style: 'custom', showTimer: false, backgroundMediaId: null });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!screen) return;
    setError(null);
    setForm(
      screen === 'new'
        ? { title: '', subtitle: '', style: 'custom', showTimer: false, backgroundMediaId: null }
        : { title: screen.title, subtitle: screen.subtitle, style: screen.style, showTimer: screen.showTimer, backgroundMediaId: screen.backgroundMediaId },
    );
  }, [screen]);

  const backgrounds = media.filter((m) => m.kind === 'image' || m.kind === 'video');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Enter a title.');
    try {
      await onSave(screen === 'new' ? null : screen, { ...form, title: form.title.trim(), subtitle: form.subtitle.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the screen.');
    }
  };

  return (
    <Modal
      open={!!screen}
      onClose={onClose}
      title={screen === 'new' ? 'New custom screen' : 'Edit screen'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="screen-form">
            Save
          </Button>
        </>
      }
    >
      <form id="screen-form" onSubmit={submit} className="grid gap-4">
        <Field label="Title">
          <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Faculty Interaction Session" maxLength={120} />
        </Field>
        <Field label="Subtitle" hint={form.style === 'coming-up' ? 'Leave empty to announce the next show flow item automatically.' : undefined}>
          <TextInput value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Starting in 5 minutes" maxLength={300} />
        </Field>
        <Field label="Colour">
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => setForm({ ...form, style: s.value })}
                className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ring-1', form.style === s.value ? 'bg-sky-500/15 text-white ring-sky-400' : 'text-slate-300 ring-white/10 hover:bg-white/5')}
              >
                <ScreenDot style={s.value} /> {s.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Background" hint="An image or video from the library. Leave empty for the animated background.">
          <select
            value={form.backgroundMediaId ?? ''}
            onChange={(e) => setForm({ ...form, backgroundMediaId: e.target.value || null })}
            className="w-full rounded-lg border border-white/10 bg-console-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
          >
            <option value="">Animated background</option>
            {backgrounds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex cursor-pointer items-center justify-between rounded-lg bg-console-950 px-3 py-2 text-sm">
          <span className="text-slate-300">Show the countdown when this screen goes live</span>
          <input type="checkbox" className="h-4 w-4 accent-sky-400" checked={form.showTimer} onChange={(e) => setForm({ ...form, showTimer: e.target.checked })} />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  );
}

const PRESETS = [1, 2, 5, 10, 15];

function CountdownModal({ screen, onClose, onStart }: { screen: Screen | null; onClose: () => void; onStart: (ms: number) => void }) {
  const [value, setValue] = useState('05:00');
  const [error, setError] = useState<string | null>(null);
  const start = (e?: FormEvent) => {
    e?.preventDefault();
    const ms = parseClock(value);
    if (!ms || ms < 1000) return setError('Enter a time like 05:00.');
    onStart(ms);
  };
  return (
    <Modal
      open={!!screen}
      onClose={onClose}
      size="sm"
      title={`${screen?.title ?? ''} — with countdown`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => start()}>
            Show &amp; start
          </Button>
        </>
      }
    >
      <form onSubmit={start} className="grid gap-3">
        <TextInput value={value} onChange={(e) => setValue(e.target.value)} className="text-center font-mono text-2xl" aria-label="Countdown" />
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((m) => (
            <button key={m} type="button" onClick={() => setValue(formatClock(m * 60_000))} className="rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10">
              {m} min
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">The screen shows the countdown in large numbers. Use the Timer panel to pause, add time or hide it.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  );
}
