import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import type { QueueItem } from '../../types';

interface Props {
  item: QueueItem | null;
  onClose: () => void;
  onSave: (id: string, patch: { title: string | null; notes: string; durationSeconds: number | null }) => Promise<void>;
}

export function QueueItemModal({ item, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title ?? '');
    setNotes(item.notes);
    setMinutes(item.durationSeconds ? String(Math.round((item.durationSeconds / 60) * 10) / 10) : '');
    setError(null);
  }, [item]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const m = minutes.trim() ? Number(minutes) : null;
    if (m !== null && (!Number.isFinite(m) || m < 0 || m > 1440)) return setError('Duration must be between 0 and 1440 minutes.');
    setBusy(true);
    try {
      await onSave(item.id, { title: title.trim() || null, notes, durationSeconds: m === null ? null : Math.round(m * 60) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Edit queue item"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="queue-item-form" disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="queue-item-form" onSubmit={submit} className="grid gap-4">
        <p className="text-xs text-slate-500">
          File: <span className="text-slate-300">{item?.media.name}</span>
        </p>
        <Field label="Title" hint="Shown to the operator (and on presentation cards). Leave empty to use the file name.">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={item?.media.name} maxLength={200} />
        </Field>
        <Field label="Planned duration (minutes)">
          <TextInput value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="decimal" placeholder="e.g. 15" />
        </Field>
        <Field label="Speaker notes" hint="Operator-only. Never shown on the audience display.">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} maxLength={5000} placeholder="Introduce the ACM student chapter before starting slide 3." />
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Modal>
  );
}
