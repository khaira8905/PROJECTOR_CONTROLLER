import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Cloud, CloudOff, Keyboard, LayoutGrid, LogOut, Maximize, MonitorPlay, Palette, Pencil, Server, Settings } from 'lucide-react';
import { EventFormModal } from '../components/EventFormModal';
import { useAuth } from '../components/AuthGate';
import { Sidebar, NAV, type DashboardView } from '../components/Sidebar';
import { ThemePicker, ThemeSwitcher } from '../components/ThemeSwitcher';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { LivePreview } from '../components/dashboard/LivePreview';
import { LibraryTable } from '../components/dashboard/LibraryTable';
import { LiveControls, QuickScreens } from '../components/dashboard/LiveControls';
import { UpNextCard } from '../components/dashboard/UpNextCard';
import { ShowFlowPanel } from '../components/dashboard/ShowFlowPanel';
import { FlowItemModal } from '../components/dashboard/FlowItemModal';
import { PresentationLibrary } from '../components/dashboard/PresentationLibrary';
import { PreviewModal } from '../components/dashboard/PreviewModal';
import { TimerPanel } from '../components/dashboard/TimerPanel';
import { ScreensPanel } from '../components/dashboard/ScreensPanel';
import { BrandingPanel } from '../components/dashboard/BrandingPanel';
import { SchedulePanel } from '../components/dashboard/SchedulePanel';
import { ShortcutsHelp } from '../components/dashboard/ShortcutsHelp';
import type { VideoCommand } from '../components/display/DisplayStage';
import { useEventData } from '../hooks/useEventData';
import { useEventSocket } from '../hooks/useEventSocket';
import { useTimerRemaining } from '../hooks/useTimerRemaining';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { api } from '../services/api';
import { cn } from '../lib/cn';
import { itemLabel } from '../lib/flow';
import { formatEventDate } from '../lib/format';
import { timerOvertime } from '../lib/timer';
import type { ControlCommand, Media, QueueItem } from '../types';

/** The open section lives in the URL (?view=…), so a refresh keeps you where you were. */
function useDashboardView(): [DashboardView, (v: DashboardView) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view = NAV.some((n) => n.id === raw) ? (raw as DashboardView) : 'control';
  const set = useCallback(
    (v: DashboardView) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (v === 'control') next.delete('view');
          else next.set('view', v);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [view, set];
}

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);


export default function DashboardPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { status: auth, signOut } = useAuth();
  const data = useEventData(eventId);
  const { event, media, queue: flow, schedule, screens, setQueue } = data;
  const { status: system, reachable } = useSystemStatus();

  const [videoCommand, setVideoCommand] = useState<VideoCommand | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [previewing, setPreviewing] = useState<Media | null>(null);
  const [deletingMedia, setDeletingMedia] = useState<Media | null>(null);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setView] = useDashboardView();
  const videoNonce = useRef(0);
  const jumpRef = useRef<HTMLInputElement>(null);

  const quiet = useCallback(<T,>(p: Promise<T>) => p.catch(() => undefined), []);

  const { connected, joined, joinError, display, timer, presence, clockOffset, send } = useEventSocket(eventId, 'operator', {
    onQueueChanged: () => void quiet(data.reloadQueue()),
    onMediaChanged: () => void quiet(Promise.all([data.reloadMedia(), data.reloadQueue()])),
    onScheduleChanged: () => void quiet(data.reloadSchedule()),
    onScreensChanged: () => void quiet(Promise.all([data.reloadScreens(), data.reloadQueue()])),
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

  // Current / next are derived from the server's Show Flow cursor.
  const currentIndex = display?.queueItemId ? flow.findIndex((q) => q.id === display.queueItemId) : -1;
  const currentItem = currentIndex >= 0 ? flow[currentIndex] : null;
  const nextItem = currentIndex === -1 ? (flow[0] ?? null) : (flow[currentIndex + 1] ?? null);
  const onAir = (display?.mode === 'media' || display?.mode === 'screen') && !display.adHocMediaId && !!currentItem;
  const flowMediaIds = useMemo(() => new Set(flow.map((q) => q.mediaId).filter((id): id is string => !!id)), [flow]);
  const images = useMemo(() => media.filter((m) => m.kind === 'image'), [media]);
  const isLive = (presence?.displays ?? 0) > 0;
  const cloudEnabled = !!system && system.storage.provider !== 'local';
  const atEnd = !!currentItem && currentIndex === flow.length - 1 && (!display?.range || display.page >= display.range.end) && !display?.adHocMediaId;

  const videoAction = (action: VideoCommand['action']) => {
    setVideoCommand({ action, nonce: ++videoNonce.current });
    void run({ type: 'video', action });
  };

  const openDisplayWindow = () => {
    if (!eventId) return;
    const win = window.open(`/display/${eventId}`, `eventcontrol-display-${eventId}`, 'popup,width=1280,height=720');
    if (!win) toast.warning('The browser blocked the pop-up. Allow pop-ups or open the display link manually.');
  };

  const toggleOverlay = () => {
    if (!event?.overlay.mediaId) return toast.info('Choose a logo in the Branding tab first.');
    void run({ type: 'overlay', visible: !event.overlay.visible });
  };

  useKeyboardShortcuts(
    {
      ArrowRight: () => void run({ type: 'next' }),
      ' ': () => void run({ type: 'next' }),
      ArrowLeft: () => void run({ type: 'previous' }),
      PageDown: () => void run({ type: 'next' }),
      PageUp: () => void run({ type: 'previous' }),
      b: () => void run({ type: 'black' }),
      w: () => void run({ type: 'show-screen', key: 'please-wait' }),
      t: () => void run({ type: 'show-screen', key: 'technical' }),
      Escape: () => void run({ type: 'show-current' }),
      l: () => void run({ type: 'logo' }),
      o: toggleOverlay,
      f: () => void run({ type: 'fullscreen' }),
      g: () => jumpRef.current?.focus(),
      p: () => void run({ type: 'timer-toggle' }),
      r: () => void run({ type: 'timer-reset' }),
      '?': () => setHelpOpen(true),
    },
    !!eventId,
  );

  // ---- Library / flow actions ----------------------------------------------------------

  const upload = async (files: File[], folder: string) => {
    if (!eventId) return;
    setUploadProgress(0);
    try {
      const result = await api.uploadMedia(eventId, files, setUploadProgress, folder);
      if (result.uploaded.length) toast.success(result.uploaded.length === 1 ? `Uploaded "${result.uploaded[0].name}".` : `Uploaded ${result.uploaded.length} files.`);
      if (result.uploaded.some((m) => m.kind === 'presentation')) toast.info('Converting PowerPoint slides in the background…');
      if (result.duplicates.length) toast.info(`${result.duplicates.map((d) => `"${d.name}"`).join(', ')} already in the library — skipped.`);
      result.rejected.forEach((r) => toast.error(`${r.name}: ${r.error}`));
      await data.reloadMedia();
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to upload file.'));
    } finally {
      setUploadProgress(null);
    }
  };

  const addToFlow = async (m: Media, startPage: number | null = null, endPage: number | null = null) => {
    if (!eventId) return;
    try {
      await api.addToQueue(eventId, m.id, { startPage, endPage });
      await data.reloadQueue();
      toast.success(`Added "${m.name}" to the show flow.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to add to the show flow.'));
    }
  };

  const reorder = async (next: QueueItem[]) => {
    if (!eventId) return;
    setQueue(next); // optimistic
    try {
      setQueue(await api.reorderQueue(eventId, next.map((q) => q.id)));
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to reorder the show flow.'));
      await quiet(data.reloadQueue());
    }
  };

  const removeFromFlow = async (item: QueueItem) => {
    try {
      await api.deleteQueueItem(item.id);
      await data.reloadQueue();
      toast.info(`Removed "${itemLabel(item)}" from the show flow.`);
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
      window.open(`${m.url}?download=1`, '_blank', 'noopener');
    }
  };

  const setEventField = async (patch: Parameters<typeof api.updateEvent>[1], message: string) => {
    if (!eventId) return;
    try {
      await api.updateEvent(eventId, patch);
      await data.reloadEvent();
      toast.success(message);
    } catch (err) {
      toast.error(errorMessage(err, 'Unable to update the event.'));
    }
  };

  if (data.error || joinError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Unable to open event</h1>
        <p className="text-slate-400">{data.error ?? joinError}</p>
        <Link to="/" className="text-sky-400 hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  const logo = event?.logoMediaId ? media.find((m) => m.id === event.logoMediaId && !m.missing) : undefined;
  const pageCount = display?.mode === 'media' && display.media?.pdfUrl ? (display.media.pageCount ?? null) : null;
  const previousItem = currentIndex > 0 ? flow[currentIndex - 1] : null;

  const library = (kinds: Media['kind'][], title: string) => (
    <PresentationLibrary
      className="min-h-[70dvh]"
      title={title}
      kinds={kinds}
      media={media}
      logoMediaId={event?.logoMediaId ?? null}
      overlayMediaId={event?.overlay.mediaId ?? null}
      flowMediaIds={flowMediaIds}
      cloudEnabled={cloudEnabled}
      uploadProgress={uploadProgress}
      onUpload={upload}
      onPreview={setPreviewing}
      onAddToFlow={(m) => void addToFlow(m)}
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
      onMove={async (m, folder) => {
        try {
          await api.moveMedia(m.id, folder);
          await data.reloadMedia();
          toast.success(folder ? `Moved "${m.name}" to ${folder}.` : `"${m.name}" is now unfiled.`);
        } catch (err) {
          toast.error(errorMessage(err, 'Unable to move file.'));
        }
      }}
      onSetLogo={(m) => void setEventField({ logoMediaId: m?.id ?? null }, m ? `"${m.name}" is now the full-screen logo.` : 'Full-screen logo removed.')}
      onSetOverlay={(m) => {
        void run({ type: 'overlay', mediaId: m.id });
        toast.success(`"${m.name}" is the overlay logo. Use "Show logo overlay" (or O) to display it.`);
      }}
      onReconvert={async (m) => {
        try {
          await api.reconvertMedia(m.id);
          toast.info(`Converting "${m.name}"…`);
        } catch (err) {
          toast.error(errorMessage(err, 'Unable to convert.'));
        }
      }}
      onDelete={setDeletingMedia}
    />
  );

  const showFlow = (className: string) => (
    <ShowFlowPanel
      className={className}
      flow={flow}
      screens={screens}
      currentId={display?.queueItemId ?? null}
      nextId={nextItem?.id ?? null}
      onAir={onAir}
      onReorder={reorder}
      onShow={(item) => void run({ type: 'show-item', queueItemId: item.id })}
      onEdit={setEditingItem}
      onRemove={removeFromFlow}
      onAddFile={() => setView('presentations')}
      onAddScreen={async (s) => {
        if (!eventId) return;
        try {
          await api.addScreenToFlow(eventId, s.id);
          await data.reloadQueue();
          toast.success(`Added "${s.title}" to the show flow.`);
        } catch (err) {
          toast.error(errorMessage(err, 'Unable to add the screen.'));
        }
      }}
    />
  );

  const timerPanel = (className?: string) => (
    <TimerPanel className={className} timer={timer} remaining={remaining} overtime={timer ? timerOvertime(timer, clockOffset) : 0} send={(cmd) => void run(cmd)} />
  );

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        view={view}
        onView={setView}
        logoUrl={logo?.url ?? null}
        eventName={event?.name ?? 'EventControl'}
        venue={event?.venue ?? ''}
        disk={system?.disk}
        signedIn={!!auth?.enabled}
        onSignOut={signOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Top bar ───────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-console-900">
          <div className="flex min-h-[72px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
            <Link to="/" className="rounded-md p-1 text-slate-400 hover:text-white lg:hidden" aria-label="All events">
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[21px] leading-tight font-bold tracking-[-0.015em] text-white">{event?.name ?? 'Loading…'}</h1>
              <p className="text-sm text-slate-500">Event Control</p>
            </div>
            <div className="flex flex-wrap items-center">
              <TopStatus
                tone={isLive ? 'ok' : 'bad'}
                icon={<span className={cn('h-2.5 w-2.5 rounded-full', isLive ? 'ec-dot-live bg-emerald-500 text-emerald-500/50' : 'animate-pulse-soft bg-red-500')} />}
                title={isLive ? 'Display Connected' : 'Display Offline'}
                detail={isLive ? (presence!.displays > 1 ? `${presence!.displays} projector windows` : 'Projector window open') : 'Open the display window'}
              />
              {system && (
                <TopStatus
                  tone={!cloudEnabled ? 'neutral' : system.storage.ok ? 'ok' : 'bad'}
                  icon={system.storage.ok ? <Cloud size={20} /> : <CloudOff size={20} />}
                  title={cloudEnabled ? (system.storage.ok ? (system.storage.pending ? 'Cloud Syncing' : 'Cloud Synced') : 'Cloud Offline') : 'Local Storage'}
                  detail={
                    uploadProgress !== null
                      ? `Uploading ${Math.round(uploadProgress * 100)}%`
                      : cloudEnabled
                        ? system.storage.pending
                          ? `${system.storage.pending} file${system.storage.pending > 1 ? 's' : ''} uploading`
                          : 'All files backed up'
                        : 'Files kept on this computer'
                  }
                  hint={system.storage.message}
                />
              )}
              {!(connected && reachable) && <TopStatus tone="bad" icon={<Server size={20} />} title="Server Offline" detail="Reconnecting…" />}
            </div>
            <div className="flex items-center gap-1 border-l border-[var(--line)] pl-4 max-sm:border-l-0 max-sm:pl-0">
              <ThemeSwitcher />
              <Button variant="ghost" icon={<Settings size={18} />} onClick={() => setView('settings')} className="max-xl:hidden">
                Settings
              </Button>
              <Button variant="primary" icon={<MonitorPlay size={16} />} onClick={openDisplayWindow} className="ml-1">
                <span className="max-sm:hidden">Open Display</span>
              </Button>
            </div>
          </div>
          {!connected && !data.loading && (
            <div className="border-t border-amber-500/30 bg-amber-400/15 px-4 py-1.5 text-center text-xs text-amber-200">
              Connection to the EventControl server lost — reconnecting automatically. The display keeps showing the last content.
            </div>
          )}
          {/* Sections, for screens too narrow for the sidebar. */}
          <nav className="scroll-thin flex gap-1 overflow-x-auto border-t border-[var(--line)] px-3 py-1.5 lg:hidden" aria-label="Console sections">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-current={view === id ? 'page' : undefined}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm', view === id ? 'bg-sky-500/12 font-semibold text-sky-300' : 'text-slate-400')}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        </header>

        <main key={view} className="ec-page-in min-w-0 flex-1 p-3 sm:p-4">
          {view === 'control' && (
            <div
              className="grid gap-4 lg:h-[calc(100dvh-72px-2rem)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] 2xl:grid-cols-[minmax(0,1fr)_452px]"
              style={{ '--preview-h': 'clamp(200px, calc(100dvh - 590px), 640px)' } as CSSProperties}
            >
              <div className="scroll-thin flex min-h-0 min-w-0 flex-col gap-4 lg:overflow-y-auto [&>*]:shrink-0">
                <LivePreview
                  display={display}
                  timer={timer}
                  timerRemaining={remaining}
                  videoCommand={videoCommand}
                  live={isLive}
                  currentItem={currentItem}
                  nextItem={nextItem}
                  previousItem={previousItem}
                  canNext={flow.length > 0 && joined && !atEnd}
                  canPrevious={flow.length > 0 && joined}
                  onNext={() => void run({ type: 'next' })}
                  onPrevious={() => void run({ type: 'previous' })}
                  onShowItem={(item) => void run({ type: 'show-item', queueItemId: item.id })}
                  onGoToPage={(page) => void run({ type: 'page', page })}
                  onVideo={videoAction}
                  onFullscreen={() => void run({ type: 'fullscreen' })}
                  onEditNotes={setEditingItem}
                  onOpenExternally={(id) => {
                    const m = media.find((x) => x.id === id);
                    if (m) void openMedia(m);
                  }}
                />
                <LibraryTable
                  className="min-h-[220px] flex-1"
                  media={media}
                  flowMediaIds={flowMediaIds}
                  uploadProgress={uploadProgress}
                  onUpload={(files) => void upload(files, '')}
                  onPreview={setPreviewing}
                  onShowNow={(m) => void run({ type: 'show-media', mediaId: m.id })}
                  onAddToFlow={(m) => void addToFlow(m)}
                  onOpen={openMedia}
                  onDelete={setDeletingMedia}
                  onManage={() => setView('presentations')}
                />
              </div>
              <div className="scroll-thin flex min-h-0 min-w-0 flex-col gap-4 lg:overflow-y-auto [&>*]:shrink-0">
                <LiveControls
                  display={display}
                  disabled={!joined}
                  canNext={flow.length > 0 && !atEnd}
                  canPrevious={flow.length > 0}
                  pageCount={pageCount}
                  jumpRef={jumpRef}
                  onResume={() => void run({ type: 'show-current' })}
                  onNext={() => void run({ type: 'next' })}
                  onPrevious={() => void run({ type: 'previous' })}
                  onGoToPage={(page) => void run({ type: 'page', page })}
                  onShortcuts={() => setHelpOpen(true)}
                />
                <QuickScreens
                  display={display}
                  disabled={!joined}
                  onPleaseWait={() => void run({ type: 'show-screen', key: 'please-wait' })}
                  onTechnical={() => void run({ type: 'show-screen', key: 'technical' })}
                  onBlack={() => void run({ type: 'black' })}
                  onLogo={() => void run({ type: 'logo' })}
                />
                {timerPanel()}
                {showFlow('min-h-[240px] flex-1')}
              </div>
            </div>
          )}

          {view === 'presentations' && library(['presentation', 'pdf'], 'Presentations')}
          {view === 'media' && library(['image', 'video'], 'Media Library')}

          {view === 'flow' && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {showFlow('min-h-[70dvh]')}
              <div className="flex flex-col gap-4">
                <UpNextCard current={currentItem} next={nextItem} onEditNotes={setEditingItem} />
                <p className="px-1 text-sm text-slate-500">
                  Drag the handles to reorder. Double-click an item to put it on the display. Press <b className="text-slate-300">Edit</b> to change slide ranges, durations and notes.
                </p>
              </div>
            </div>
          )}

          {view === 'screens' && (
            <Panel title="Screens" icon={<LayoutGrid size={20} />} className="mx-auto max-w-3xl">
              <ScreensPanel
                screens={screens}
                display={display}
                media={media}
                onShow={(s, timerMs) => void run({ type: 'show-screen', screenId: s.id, timerMs })}
                onAddToFlow={async (s) => {
                  if (!eventId) return;
                  await quiet(api.addScreenToFlow(eventId, s.id));
                  await data.reloadQueue();
                  toast.success(`Added "${s.title}" to the show flow.`);
                }}
                onSave={async (s, input) => {
                  if (!eventId) return;
                  if (s) await api.updateScreen(s.id, input);
                  else await api.createScreen(eventId, input);
                  await data.reloadScreens();
                  toast.success('Screen saved.');
                }}
                onDelete={async (s) => {
                  try {
                    await api.deleteScreen(s.id);
                    await Promise.all([data.reloadScreens(), data.reloadQueue()]);
                  } catch (err) {
                    toast.error(errorMessage(err, 'Unable to delete the screen.'));
                  }
                }}
              />
            </Panel>
          )}

          {view === 'branding' && (
            <Panel title="Branding" icon={<Palette size={20} />} className="mx-auto max-w-2xl">
              <BrandingPanel event={event} images={images} onChange={(patch) => void run({ type: 'overlay', ...patch })} />
            </Panel>
          )}

          {view === 'timers' && (
            <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
              {timerPanel()}
              <Panel title="Schedule" icon={<CalendarClock size={20} />}>
                <SchedulePanel
                  embedded
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
              </Panel>
            </div>
          )}

          {view === 'settings' && (
            <SettingsView
              eventName={event?.name ?? ''}
              eventMeta={[event?.venue, event?.date ? formatEventDate(event.date) : null].filter(Boolean).join(' · ')}
              displayUrl={eventId ? `${window.location.origin}/display/${eventId}` : ''}
              signedIn={!!auth?.enabled}
              onEditEvent={() => setEditEventOpen(true)}
              onOpenDisplay={openDisplayWindow}
              onFullscreen={() => void run({ type: 'fullscreen' })}
              onShortcuts={() => setHelpOpen(true)}
              onSignOut={signOut}
              onCopied={() => toast.success('Display link copied.')}
            />
          )}
        </main>
      </div>

      <FlowItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={async (id, patch) => {
          await api.updateQueueItem(id, patch);
          await data.reloadQueue();
          toast.success('Show flow item updated.');
        }}
      />
      <PreviewModal
        media={previewing}
        onClose={() => setPreviewing(null)}
        onShowPage={(m, page) => void run({ type: 'show-media', mediaId: m.id, page: m.pdfUrl ? page : undefined })}
        onAddToFlow={(m, start, end) => void addToFlow(m, start, end)}
      />
      <EventFormModal
        open={editEventOpen}
        event={event}
        logoOptions={images}
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
        title="Delete file?"
        message={
          <>
            <b className="text-white">{deletingMedia?.name}</b> will be deleted{cloudEnabled ? ' from this computer and the cloud' : ''}
            {deletingMedia && flowMediaIds.has(deletingMedia.id) ? ' and removed from the show flow' : ''}. This cannot be undone.
          </>
        }
        onClose={() => setDeletingMedia(null)}
        onConfirm={async () => {
          if (!deletingMedia) return;
          try {
            await api.deleteMedia(deletingMedia.id);
            await Promise.all([data.reloadMedia(), data.reloadQueue(), data.reloadEvent()]);
            toast.success('File deleted.');
          } catch (err) {
            toast.error(errorMessage(err, 'Unable to delete file.'));
          }
        }}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

/** One status in the top bar: a coloured signal, a title and a quieter detail line. */
function TopStatus({ tone, icon, title, detail, hint }: { tone: 'ok' | 'bad' | 'neutral'; icon: ReactNode; title: string; detail: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 border-l border-[var(--line)] px-4 first:border-l-0" title={hint}>
      <span className={cn('flex shrink-0 items-center', tone === 'bad' ? 'text-red-400' : tone === 'ok' ? 'text-slate-400' : 'text-slate-400')}>{icon}</span>
      <div className="leading-tight">
        <p className={cn('text-[13px] font-semibold', tone === 'bad' ? 'text-red-400' : 'text-white')}>{title}</p>
        <p className="text-xs text-slate-500 max-md:hidden">{detail}</p>
      </div>
    </div>
  );
}

function SettingsView({
  eventName,
  eventMeta,
  displayUrl,
  signedIn,
  onEditEvent,
  onOpenDisplay,
  onFullscreen,
  onShortcuts,
  onSignOut,
  onCopied,
}: {
  eventName: string;
  eventMeta: string;
  displayUrl: string;
  signedIn: boolean;
  onEditEvent: () => void;
  onOpenDisplay: () => void;
  onFullscreen: () => void;
  onShortcuts: () => void;
  onSignOut: () => void;
  onCopied: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Panel title="Event" icon={<Pencil size={18} />} actions={<Button size="sm" variant="secondary" onClick={onEditEvent}>Edit details</Button>}>
        <p className="text-[15px] font-semibold text-white">{eventName}</p>
        <p className="text-sm text-slate-500">{eventMeta || 'No date or venue yet.'}</p>
      </Panel>
      <Panel title="Appearance" icon={<Palette size={18} />}>
        <p className="mb-3 text-sm text-slate-500">Colours of this console. The projector output is not affected.</p>
        <ThemePicker />
      </Panel>
      <Panel title="Projector" icon={<MonitorPlay size={18} />} bodyClassName="grid gap-3">
        <p className="text-sm text-slate-500">
          Open the display on the computer connected to the projector (or drag this window there), then press <b className="text-slate-300">F</b> in it for fullscreen.
        </p>
        <div className="flex overflow-hidden rounded-lg border border-[var(--line-strong)]">
          <input readOnly value={displayUrl} className="min-w-0 flex-1 bg-console-850 px-3 font-mono text-[13px] text-slate-300 focus:outline-none" onFocus={(e) => e.target.select()} aria-label="Display link" />
          <button
            className="border-l border-[var(--line-strong)] px-3 text-sm font-medium text-slate-200 hover:bg-console-700"
            onClick={() => void navigator.clipboard?.writeText(displayUrl).then(onCopied, () => undefined)}
          >
            Copy link
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<MonitorPlay size={16} />} onClick={onOpenDisplay}>
            Open display window
          </Button>
          <Button icon={<Maximize size={15} />} onClick={onFullscreen}>
            Make display fullscreen
          </Button>
        </div>
      </Panel>
      <Panel title="Keyboard & account" icon={<Keyboard size={18} />} bodyClassName="flex flex-wrap gap-2">
        <Button icon={<Keyboard size={15} />} onClick={onShortcuts}>
          Keyboard shortcuts
        </Button>
        {signedIn && (
          <Button icon={<LogOut size={15} />} onClick={onSignOut}>
            Sign out
          </Button>
        )}
      </Panel>
    </div>
  );
}
