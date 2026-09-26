import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { formatClock, parseClock } from '../../lib/format';
import { pageWord } from '../../lib/flow';
import type { QueueItem } from '../../types';

export interface FlowItemPatch {
  title: string | null;
  notes: string;
  script?: string;
  durationSeconds: number | null;
  startPage?: number | null;
  endPage?: number | null;
}

interface Props {
  item: QueueItem | null;
  onClose: () => void;
  onSave: (id: string, patch: FlowItemPatch) => Promise<void>;
}

/** Edit a Show Flow item: title, slide range, planned duration, notes and the presenter script. */
export function FlowItemModal({ item, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [script, setScript] = useState('');
  const [duration, setDuration] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const count = item?.media?.pdfUrl ? (item.media.pageCount ?? null) : null;
  const word = pageWord(item?.media, true);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title ?? '');
    setNotes(item.notes);
    setScript(item.script ?? '');
    setDuration(item.durationSeconds ? formatClock(item.durationSeconds * 1000) : '');
    setStart(item.startPage ? String(item.startPage) : '');
    setEnd(item.endPage ? String(item.endPage) : '');
    setError(null);
  }, [item]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const ms = duration.trim() ? parseClock(duration) : null;
    if (duration.trim() && ms === null) return setError('Enter the duration like 10:00 or 0:30.');
    const s = start ? Number(start) : null;
    const en = end ? Number(end) : null;
    if (count && ((s && (s < 1 || s > count)) || (en && (en < 1 || en > count)))) return setError(`Choose ${word} between 1 and ${count}.`);
    if (s && en && s > en) return setError(`The first ${pageWord(item.media)} must come before the last.`);
    setBusy(true);
    try {
      await onSave(item.id, {
        title: title.trim() || null,
        notes,
        script,
        durationSeconds: ms === null ? null : Math.round(ms / 1000),
        ...(item.kind === 'media' ? { startPage: s, endPage: en } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  };

  const fallbackTitle = item?.kind === 'screen' ? item.screen?.title : item?.media?.name;

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Edit show flow item"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="flow-item-form" disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="flow-item-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <p className="text-xs text-slate-500 sm:col-span-2">
          {item?.kind === 'screen' ? 'Screen' : 'File'}: <span className="text-slate-300">{fallbackTitle}</span>
        </p>
        <Field label="Title" hint="Shown to the operator. Leave empty to use the file/screen name." className="sm:col-span-2">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={fallbackTitle ?? ''} maxLength={200} />
        </Field>
        {item?.kind === 'media' && count && (
          <>
            <Field label={`First ${pageWord(item.media)}`} hint={`1–${count}`}>
              <TextInput value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1" />
            </Field>
            <Field label={`Last ${pageWord(item.media)}`} hint="NEXT moves on to the next item after this">
              <TextInput value={end} onChange={(e) => setEnd(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={String(count)} />
            </Field>
          </>
        )}
        <Field
          label="Duration"
          hint={item?.kind === 'screen' && item.screen?.showTimer ? 'Starts the countdown when this screen goes live.' : 'Planned time (for reference).'}
          className="sm:col-span-2"
        >
          <TextInput value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 10:00 or 0:30" className="font-mono" />
        </Field>
        <Field label="Speaker notes" hint="Operator-only. Never shown on the audience display." className="sm:col-span-2">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} placeholder="Introduce the ACM student chapter before starting slide 3." />
        </Field>
        <Field label="Script" hint="What to say during this item. Shown large in the script layout; never on the audience display." className="sm:col-span-2">
          <TextArea value={script} onChange={(e) => setScript(e.target.value)} rows={8} maxLength={20000} placeholder={'Good evening, everyone, and welcome to…'} />
        </Field>
        {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
