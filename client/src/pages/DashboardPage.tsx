import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Keyboard, MonitorPlay, Pencil, Radio, WifiOff } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { EventFormModal } from '../components/EventFormModal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Panel } from '../components/ui/Panel';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { ProgramMonitor, TransportControls } from '../components/dashboard/ProgramMonitor';
import { UpNextCard, itemLabel } from '../components/dashboard/UpNextCard';
import { QueuePanel } from '../components/dashboard/QueuePanel';
import { QueueItemModal } from '../components/dashboard/QueueItemModal';
import { MediaLibrary } from '../components/dashboard/MediaLibrary';
import { TimerPanel } from '../components/dashboard/TimerPanel';
import { DisplayControls } from '../components/dashboard/DisplayControls';
import { SchedulePanel } from '../components/dashboard/SchedulePanel';
import { ShortcutsHelp } from '../components/dashboard/ShortcutsHelp';
import type { VideoCommand } from '../components/display/DisplayStage';
import { useEventData } from '../hooks/useEventData';
import { useEventSocket } from '../hooks/useEventSocket';
import { useTimerRemaining } from '../hooks/useTimerRemaining';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { api } from '../services/api';
import { formatEventDate } from '../lib/format';
import type { ControlCommand, Media, QueueItem } from '../types';

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export default function DashboardPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useEventData(eventId);
  const { event, media, queue, schedule, setQueue } = data;

  const [videoCommand, setVideoCommand] = useState<VideoCommand | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [deletingMedia, setDeletingMedia] = useState<Media | null>(null);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const videoNonce = useRef(0);

  const quiet = useCallback(<T,>(p: Promise<T>) => p.catch(() => undefined), []);

  const { connected, joined, joinError, display, timer, presence, clockOffset, send } = useEventSocket(eventId, 'operator', {
    onQueueChanged: () => void quiet(data.reloadQueue()),
    onMediaChanged: () => void quiet(data.reloadMedia()),
    onScheduleChanged: () => void quiet(data.reloadSchedule()),
    onEventChanged: () => void quiet(data.reloadEvent()),
    onEventDeleted: () => {
      toast.warning('This event was deleted.');
      navigate('/');
    },
    onFullscreenResult: (ok) =>
      ok ? toast.success('Display is now fullscreen.') : toast.warning('The display blocked fullscreen. Click once on the display window (or press F there).'),
  });
  const remaining = useTimerRemaining(timer, clockOffset);

  /** Sends a control command and surfaces any error as a toast. */
  const run = useCallback(
    async (command: ControlCommand) => {
      const res = await send(command);
      if (!res.ok) toast.error(res.error);
      return res.ok;
    },
    [send, toast],
  );

  // Reset the PDF page count when the programmed media changes.
  const mediaId = display?.media?.id;
  useEffect(() => setPdfPageCount(null), [mediaId]);

  useEffect(() => {
    if (event) document.title = `${event.name} · EventControl`;
  }, [event]);

  // Warn the operator when the projector drops off.
  const previousDisplays = useRef<number | null>(null);
  useEffect(() => {
    if (!presence) return;
    const prev = previousDisplays.current;
    if (prev !== null && prev > 0 && presence.displays === 0) toast.error('Display connection lost.');
    if (prev === 0 && presence.displays > 0) toast.success('Display connected.');
    previousDisplays.current = presence.displays;
  }, [presence, toast]);

  // Current / next are derived from the server's queue cursor.
  const currentIndex = display?.queueItemId ? queue.findIndex((q) => q.id === display.queueItemId) : -1;
  const currentItem = currentIndex >= 0 ? queue[currentIndex] : null;
  const nextItem = currentIndex === -1 ? (queue[0] ?? null) : (queue[currentIndex + 1] ?? null);
  const onAir = display?.mode === 'media' && !display.adHocMediaId;
  const canNext = queue.length > 0 && (currentIndex === -1 || currentIndex < queue.length - 1);
  const canPrevious = queue.length > 0 && (currentIndex !== 0 || !!display?.adHocMediaId);
  const queuedMediaIds = useMemo(() => new Set(queue.map((q) => q.mediaId)), [queue]);
  const isLive = (presence?.displays ?? 0) > 0;

  const videoAction = (action: VideoCommand['action']) => {
    setVideoCommand({ action, nonce: ++videoNonce.current });
    void run({ type: 'video', action });
  };

  const changePage = (delta: number) => {
    if (!display || display.media?.kind !== 'pdf' || display.mode !== 'media') return;
    const target = display.page + delta;
    if (target < 1 || (pdfPageCount !== null && target > pdfPageCount)) return;
    void run({ type: 'page', delta });
  };

  const openDisplayWindow = () => {
    if (!eventId) return;
    const win = window.open(`/display/${eventId}`, `eventcontrol-display-${eventId}`, 'popup,width=1280,height=720');
    if (!win) toast.warning('The browser blocked the pop-up. Allow pop-ups or open the display link manually.');
  };

  useKeyboardShortcuts(
    {
      ArrowRight: () => void run({ type: 'next' }),
      ArrowLeft: () => void run({ type: 'previous' }),
      ' ': () => void run({ type: 'timer-toggle' }),
      b: () => void run({ type: 'black' }),
      w: () => void run({ type: 'waiting' }),
      l: () => void run({ type: 'logo' }),
      s: () => void run({ type: 'show-current' }),
      f: () => void run({ type: 'fullscreen' }),
      r: () => void run({ type: 'timer-reset' }),
      PageDown: () => changePage(1),
      PageUp: () => changePage(-1),
      '?': () => setHelpOpen(true),
    },
    !!eventId,
  );

  // ---- Media / queue actions -------------------------------------------------

  const upload = async (files: File[]) => {
    if (!eventId) return;
    setUploadProgress(0);
    try {
      const result = await api.uploadMedia(eventId, files, setUploadProgress);
      if (result.uploaded.length) toast.success(result.uploaded.length === 1 ? `Uploaded "${result.uploaded[0].name}".` : `Uploaded ${result.uploaded.length} files.`);
      if (result.duplicates.length) toast.info(`${result.duplicates.map((d) => `"${d.name}"`).join(', ')} already in the library — skipped.`);
      result.rejected.forEach((r) => toast.error(`${r.name}: ${r.error}`));
      await data.reloadMedia();
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to upload file.'));
    } finally {
      setUploadProgress(null);
    }
  };

  const addToQueue = async (m: Media) => {
    if (!eventId) return;
    try {
      await api.addToQueue(eventId, m.id);
      await data.reloadQueue();
      toast.success(`Added "${m.name}" to the queue.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to add to queue.'));
    }
  };

  const reorder = async (next: QueueItem[]) => {
    if (!eventId) return;
    setQueue(next); // optimistic
    try {
      setQueue(await api.reorderQueue(eventId, next.map((q) => q.id)));
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to reorder the queue.'));
      await quiet(data.reloadQueue());
    }
  };

  const removeFromQueue = async (item: QueueItem) => {
    try {
      await api.deleteQueueItem(item.id);
      await data.reloadQueue();
      toast.info(`Removed "${itemLabel(item)}" from the queue.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to remove item.'));
    }
  };

  const openMedia = async (m: Media) => {
    if (m.kind !== 'presentation') {
      window.open(m.url, '_blank', 'noopener');
      return;
    }
    try {
      await api.openMediaExternally(m.id);
      toast.success(`Opening "${m.name}" in PowerPoint on the server machine…`);
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to start presentation.'));
      // Fall back to downloading, which lets the operator's OS open it.
      window.open(`${m.url}?download=1`, '_blank', 'noopener');
    }
  };

  const openMediaById = (id: string) => {
    const m = media.find((x) => x.id === id);
    if (m) void openMedia(m);
  };

  if (data.error || joinError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Unable to open event</h1>
        <p className="text-slate-400">{data.error ?? joinError}</p>
        <Link to="/" className="text-sky-400 hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-console-950/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Back to events">
            <ArrowLeft size={18} />
            <BrandMark compact />
          </Link>
          <div className="min-w-0 flex-1 sm:flex-none">
            <h1 className="truncate text-lg leading-tight font-semibold text-white">{event?.name ?? 'Loading…'}</h1>
            <p className="text-xs text-slate-500">
              {event ? formatEventDate(event.date) : ''}
              {event?.venue ? ` · ${event.venue}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <Badge tone="live" dot>
                Live · {presence?.displays} display{presence?.displays === 1 ? '' : 's'}
              </Badge>
            ) : (
              <Badge tone="neutral">Offline</Badge>
            )}
            {!connected && (
              <Badge tone="warning" className="animate-pulse-soft">
                <WifiOff size={11} /> Server disconnected
              </Badge>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Keyboard size={15} />} onClick={() => setHelpOpen(true)} className="max-md:hidden">
              Shortcuts
            </Button>
            <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditEventOpen(true)} disabled={!event} aria-label="Edit event">
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button variant="primary" size="sm" icon={<MonitorPlay size={15} />} onClick={openDisplayWindow}>
              Open Display
            </Button>
          </div>
        </div>
        {!connected && !data.loading && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-200">
            Connection to the EventControl server lost — reconnecting automatically. Controls are paused until it's back.
          </div>
        )}
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-12 [&>*]:min-w-0">
        {/* Left: queue */}
        <QueuePanel
          className="lg:col-span-4 lg:max-h-[calc(100vh-6rem)] xl:col-span-3"
          queue={queue}
          currentId={display?.queueItemId ?? null}
          nextId={nextItem?.id ?? null}
          onAir={onAir}
          onReorder={reorder}
          onShow={(item) => void run({ type: 'show-item', queueItemId: item.id })}
          onEdit={setEditingItem}
          onRemove={removeFromQueue}
        />

        {/* Centre: program output and transport */}
        <div className="flex flex-col gap-4 lg:col-span-8 xl:col-span-6">
          <Panel bodyClassName="flex flex-col gap-4">
            <ProgramMonitor
              display={display}
              timer={timer}
              timerRemaining={remaining}
              currentItem={currentItem}
              videoCommand={videoCommand}
              pdfPageCount={pdfPageCount}
              onPdfPageCount={setPdfPageCount}
              onOpenExternally={openMediaById}
              onCommand={(cmd) => {
                if (cmd === 'video-play') videoAction('play');
                else if (cmd === 'video-pause') videoAction('pause');
                else if (cmd === 'video-restart') videoAction('restart');
                else if (cmd === 'page-next') changePage(1);
                else changePage(-1);
              }}
            />
            <TransportControls
              canNext={canNext && joined}
              canPrevious={canPrevious && joined}
              onNext={() => void run({ type: 'next' })}
              onPrevious={() => void run({ type: 'previous' })}
            />
            <UpNextCard current={currentItem} next={nextItem} onEditNotes={setEditingItem} />
          </Panel>

          <Panel title="Display controls" icon={<Radio size={14} />}>
            <DisplayControls
              mode={display?.mode ?? null}
              disabled={!joined}
              onBlack={() => void run({ type: 'black' })}
              onWaiting={() => void run({ type: 'waiting' })}
              onLogo={() => void run({ type: 'logo' })}
              onShowCurrent={() => void run({ type: 'show-current' })}
              onFullscreen={() => void run({ type: 'fullscreen' })}
              onOpenDisplay={openDisplayWindow}
            />
          </Panel>
        </div>

        {/* Right: timer and schedule */}
        <div className="grid gap-4 lg:col-span-12 lg:grid-cols-2 xl:col-span-3 xl:grid-cols-1 xl:content-start">
          <TimerPanel timer={timer} remaining={remaining} send={(cmd) => void run(cmd)} />
          <SchedulePanel
            className="xl:max-h-[28rem]"
            schedule={schedule}
            onAdd={async (item) => {
              if (!eventId) return;
              await api.addScheduleItem(eventId, { ...item, description: '', durationMinutes: null });
              await data.reloadSchedule();
            }}
            onDelete={async (item) => {
              try {
                await api.deleteScheduleItem(item.id);
                await data.reloadSchedule();
              } catch (err) {
                toast.error(errorMessage(err, 'Unable to delete schedule item.'));
              }
            }}
          />
        </div>

        {/* Bottom: media library */}
        <MediaLibrary
          className="lg:col-span-12"
          media={media}
          logoMediaId={event?.logoMediaId ?? null}
          queuedMediaIds={queuedMediaIds}
          uploadProgress={uploadProgress}
          onUpload={upload}
          onAddToQueue={addToQueue}
          onShowNow={(m) => void run({ type: 'show-media', mediaId: m.id })}
          onOpen={openMedia}
          onRename={async (m, name) => {
            try {
              await api.renameMedia(m.id, name);
              await Promise.all([data.reloadMedia(), data.reloadQueue()]);
            } catch (err) {
              toast.error(errorMessage(err, 'Unable to rename file.'));
            }
          }}
          onSetLogo={async (m) => {
            if (!eventId) return;
            try {
              await api.updateEvent(eventId, { logoMediaId: m?.id ?? null });
              await data.reloadEvent();
              toast.success(m ? `"${m.name}" is now the event logo.` : 'Event logo removed.');
            } catch (err) {
              toast.error(errorMessage(err, 'Unable to set logo.'));
            }
          }}
          onDelete={setDeletingMedia}
        />
      </main>

      <QueueItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={async (id, patch) => {
          await api.updateQueueItem(id, patch);
          await data.reloadQueue();
          toast.success('Queue item updated.');
        }}
      />
      <EventFormModal
        open={editEventOpen}
        event={event}
        logoOptions={media.filter((m) => m.kind === 'image')}
        onClose={() => setEditEventOpen(false)}
        onSubmit={async (input) => {
          if (!eventId) return;
          await api.updateEvent(eventId, input);
          await data.reloadEvent();
          toast.success('Event updated.');
        }}
      />
      <ConfirmDialog
        open={!!deletingMedia}
        title="Delete media?"
        message={
          <>
            <b className="text-white">{deletingMedia?.name}</b> will be deleted from disk
            {deletingMedia && queuedMediaIds.has(deletingMedia.id) ? ' and removed from the queue' : ''}. This cannot be undone.
          </>
        }
        onClose={() => setDeletingMedia(null)}
        onConfirm={async () => {
          if (!deletingMedia) return;
          try {
            await api.deleteMedia(deletingMedia.id);
            await Promise.all([data.reloadMedia(), data.reloadQueue()]);
            toast.success('Media deleted.');
          } catch (err) {
            toast.error(errorMessage(err, 'Unable to delete media.'));
          }
        }}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
