import { useEffect, useState, type FormEvent } from 'react';
import { Button } from './ui/Button';
import { Field, TextArea, TextInput } from './ui/Field';
import { Modal } from './ui/Modal';
import { todayIso } from '../lib/format';
import type { EventInput, EventSummary, Media } from '../types';

interface EventFormModalProps {
  open: boolean;
  event?: EventSummary | null;
  /** Image media that can be chosen as the event logo (edit mode only). */
  logoOptions?: Media[];
  onClose: () => void;
  onSubmit: (input: EventInput) => Promise<void>;
}

export function EventFormModal({ open, event, logoOptions, onClose, onSubmit }: EventFormModalProps) {
  const [form, setForm] = useState<EventInput>({ name: '', date: todayIso(), description: '', venue: '', waitingMessage: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      event
        ? { name: event.name, date: event.date, description: event.description, venue: event.venue, waitingMessage: event.waitingMessage, logoMediaId: event.logoMediaId }
        : { name: '', date: todayIso(), description: '', venue: '', waitingMessage: '' },
    );
  }, [open, event]);

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Event name is required.');
    if (!form.date) return setError('Event date is required.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...form, waitingMessage: form.waitingMessage?.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Edit event' : 'Create event'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="event-form" disabled={busy}>
            {busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name" className="sm:col-span-2">
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ACM Tech Fest 2026" maxLength={120} required />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </Field>
        <Field label="Venue">
          <TextInput value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Main Auditorium" maxLength={200} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this event about?" maxLength={2000} />
        </Field>
        {event && logoOptions && (
          <Field label="Event logo" hint="Shown full-screen by SHOW LOGO. Upload an image to the library first." className="sm:col-span-2">
            <select
              value={form.logoMediaId ?? ''}
              onChange={(e) => set('logoMediaId', e.target.value || null)}
              className="w-full rounded-lg border border-white/10 bg-console-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
            >
              <option value="">No logo (show event name)</option>
              {logoOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
