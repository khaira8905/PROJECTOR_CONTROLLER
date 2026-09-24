import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Film, ListVideo, MapPin, MonitorPlay, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { EventFormModal } from '../components/EventFormModal';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { api } from '../services/api';
import { formatEventDate, todayIso } from '../lib/format';
import type { EventInput, EventSummary } from '../types';

export default function EventsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventSummary | null>(null);
  const [deleting, setDeleting] = useState<EventSummary | null>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await api.listEvents());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load events.');
    }
  }, []);

  useEffect(() => {
    document.title = 'Events · EventControl';
    void load();
  }, [load]);

  const save = async (input: EventInput) => {
    if (editing) {
      await api.updateEvent(editing.id, input);
      toast.success('Event updated.');
      await load();
    } else {
      const created = await api.createEvent(input);
      toast.success('Event created.');
      navigate(`/events/${created.id}`);
    }
  };

  const today = todayIso();
  const upcoming = events?.filter((e) => e.date >= today) ?? [];
  const past = events?.filter((e) => e.date < today) ?? [];

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-console-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandMark />
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Create Event
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Events</h1>
          <p className="mt-1.5 text-slate-400">Open an event to run its presentations, projector display and timer.</p>
        </div>

        {loadError && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
            <Button size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {events === null && !loadError && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-console-900" />
            ))}
          </div>
        )}

        {events && events.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
            <MonitorPlay size={40} className="text-slate-600" />
            <h2 className="mt-4 text-lg font-semibold text-white">No events yet</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-400">Create your first event, upload slides and videos, and control the projector from one place.</p>
            <Button variant="primary" className="mt-6" icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
              Create Event
            </Button>
          </div>
        )}

        {upcoming.length > 0 && <EventGrid title="Upcoming" events={upcoming} onEdit={(e) => (setEditing(e), setFormOpen(true))} onDelete={setDeleting} />}
        {past.length > 0 && <EventGrid title="Past" events={past} onEdit={(e) => (setEditing(e), setFormOpen(true))} onDelete={setDeleting} />}
      </main>

      <EventFormModal open={formOpen} event={editing} onClose={() => setFormOpen(false)} onSubmit={save} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete event?"
        message={
          <>
            <b className="text-white">{deleting?.name}</b> and all of its media, queue and schedule will be permanently deleted.
          </>
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.deleteEvent(deleting.id);
            toast.success('Event deleted.');
            await load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unable to delete event.');
          }
        }}
      />
    </div>
  );
}

function EventGrid({
  title,
  events,
  onEdit,
  onDelete,
}: {
  title: string;
  events: EventSummary[];
  onEdit: (e: EventSummary) => void;
  onDelete: (e: EventSummary) => void;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} onEdit={() => onEdit(event)} onDelete={() => onDelete(event)} />
        ))}
      </div>
    </section>
  );
}

function EventCard({ event, onEdit, onDelete }: { event: EventSummary; onEdit: () => void; onDelete: () => void }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isToday = event.date === todayIso();

  return (
    <article className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-console-900 p-5 transition-colors hover:border-sky-500/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <CalendarDays size={15} />
          {formatEventDate(event.date)}
          {isToday && (
            <Badge tone="live" dot>
              Today
            </Badge>
          )}
        </div>
        <div className="relative">
          <Button variant="ghost" size="icon-sm" aria-label="Event actions" onClick={() => setMenuOpen((o) => !o)}>
            <MoreHorizontal size={16} />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-white/10 bg-console-800 py-1 shadow-xl">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5" onClick={() => (setMenuOpen(false), onEdit())}>
                  <Pencil size={14} /> Edit
                </button>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={() => (setMenuOpen(false), onDelete())}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-white">{event.name}</h3>
      {event.venue && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
          <MapPin size={14} /> {event.venue}
        </p>
      )}
      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500">{event.description || 'No description.'}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Film size={13} /> {event.counts?.media ?? 0} media
          </span>
          <span className="flex items-center gap-1">
            <ListVideo size={13} /> {event.counts?.queueItems ?? 0} in queue
          </span>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate(`/events/${event.id}`)}>
          Open Event
        </Button>
      </div>
    </article>
  );
}
