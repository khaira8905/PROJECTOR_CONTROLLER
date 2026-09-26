import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Image as ImageIcon, Layers, Maximize, MonitorOff, MonitorPlay, Pause, Play, RotateCcw } from 'lucide-react';
import { DisplayStage, type VideoCommand } from '../display/DisplayStage';
import { PdfThumb } from '../PdfThumb';
import { ItemPicture, KeyHint } from './ControlDeck';
import { cn } from '../../lib/cn';
import { itemDetail, itemLabel, pageWord } from '../../lib/flow';
import type { DisplaySnapshot, QueueItem, TimerSnapshot } from '../../types';

interface StagePaneProps {
  /** Flow layout: the picture grows and Quick Selection sits below. Script layout: a fixed
   *  picture and the Flow below it, taking the remaining height. */
  layout: 'flow' | 'script';
  display: DisplaySnapshot | null;
  timer: TimerSnapshot | null;
  videoCommand: VideoCommand | null;
  /** Number of connected projector windows. */
  displays: number;
  showPreview: boolean;
  nextItem: QueueItem | null;
  canNext: boolean;
  canPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onVideo: (action: VideoCommand['action']) => void;
  onOpenExternally: (mediaId: string) => void;
  onFullscreen: () => void;
  onOpenDisplay: () => void;
  /** Black Screen: offered at all, needs a second click, is on now. */
  black: { enabled: boolean; confirm: boolean; active: boolean; hint?: string };
  onBlack: () => void;
  /** Full-screen logo, toggled. */
  onLogo: () => void;
  /** Logo overlay on top of the slides (only when one has been chosen). */
  overlay: { available: boolean; visible: boolean; hint?: string };
  onOverlay: () => void;
  /** Scroll over the picture to change slides, click it for the next one. */
  mouseControls: boolean;
  /** "Open in PowerPoint" only works on the computer that runs EventControl. */
  canOpenExternally: boolean;
  /** Quick Selection, rendered at the bottom. */
  children?: ReactNode;
}

/**
 * The display workspace: what the audience is seeing (large, with its status), the
 * controls that act on the projector directly, what comes next, and the quick shortcuts.
 * The picture takes whatever height is left, so the column is balanced on any screen.
 */
export const StagePane = memo(function StagePane(props: StagePaneProps) {
  const { display, nextItem } = props;
  const live = props.displays > 0;
  const media = display?.mode === 'media' ? display.media : null;
  const paged = !!media?.pdfUrl && !!media.pageCount;
  const page = display?.page ?? 1;
  const lastPage = display?.range ? display.range.end : (media?.pageCount ?? 0);
  const nextPage = paged && !display?.adHocMediaId && page < lastPage ? page + 1 : null;
  const word = pageWord(media);
  const black = display?.mode === 'black';
  const logo = display?.mode === 'logo';
  const onAir = live && !!display && !black;
  const status = !live ? 'offline' : black ? 'black' : 'live';

  return (
    <div className="ec-stage flex flex-col px-[var(--gutter)] py-4 lg:h-full lg:min-h-0" data-layout={props.layout}>
      {/* ── Status ─────────────────────────────── */}
      <header className="ec-stage-status flex items-center gap-3" data-state={status}>
        <span className="ec-status-dot h-2.5 w-2.5 rounded-full" data-state={status === 'offline' ? 'bad' : 'ok'} aria-hidden />
        <p className="min-w-0 flex-1 truncate">
          <span className="ec-label mr-2">Projector</span>
          <span key={status} className="ec-stage-state ec-text-swap font-semibold">
            {status === 'offline' ? 'Offline' : black ? 'Black screen' : 'On air'}
          </span>
          <span className="t-support ml-2 max-xl:hidden">
            {status === 'offline' ? '— the audience sees the last picture' : props.displays > 1 ? `· ${props.displays} display windows` : '· 1 display window'}
          </span>
        </p>
        {!live && (
          <button className="ec-link text-[var(--text-sm)] font-semibold text-sky-300" onClick={props.onOpenDisplay}>
            Open display window
          </button>
        )}
      </header>

      {/* ── What the audience sees, and the controls that act on it ── */}
      <section aria-label="Projector" className="ec-preview-area mt-3">
        <div className="ec-preview-group">
          {props.showPreview ? (
            <Monitor onAir={onAir} mouse={props.mouseControls && !!display} onNext={props.canNext ? props.onNext : undefined} onPrevious={props.canPrevious ? props.onPrevious : undefined}>
              <div className="absolute inset-0 overflow-hidden rounded-t-[5px]">
                {display ? (
                  <DisplayStage display={display} timer={props.timer} variant="preview" videoCommand={props.videoCommand} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#fff]/55">Connecting to the event…</div>
                )}
                {black && <span className="ec-fade-in absolute top-2.5 left-2.5 bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-[0.25em] text-[#fff]/70 ring-1 ring-[#fff]/20">BLACK</span>}
              </div>
            </Monitor>
          ) : (
            <p className="ec-preview-off t-support px-3 py-2">Projector picture is hidden (Settings → Display).</p>
          )}

          <div className="ec-display-bar flex items-stretch" role="toolbar" aria-label="Display controls">
            {props.black.enabled && <BlackKey active={black} confirm={props.black.confirm} hint={props.black.hint} onPress={props.onBlack} />}
            <DisplayKey icon={<ImageIcon size={16} />} label="Logo" active={logo} onClick={props.onLogo} title={logo ? 'Leave the logo screen' : 'Show the full-screen logo'} />
            {props.overlay.available && (
              <DisplayKey icon={<Layers size={16} />} label="Overlay" active={props.overlay.visible} hint={props.overlay.hint} onClick={props.onOverlay} title={props.overlay.visible ? 'Hide the logo overlay' : 'Show the logo overlay on top of the slides'} />
            )}
            <span className="flex-1" />
            {media?.kind === 'presentation' && props.canOpenExternally && (
              <DisplayKey icon={<ExternalLink size={15} />} label="PowerPoint" onClick={() => props.onOpenExternally(media.id)} title="Open the original file in PowerPoint (for animations and embedded video)" />
            )}
            <DisplayKey icon={<Maximize size={15} />} label="Fullscreen" onClick={props.onFullscreen} title="Ask the projector window to go fullscreen (F)" />
          </div>

          {media?.kind === 'video' && (
            <div className="ec-display-bar ec-display-bar-sub flex items-stretch" role="toolbar" aria-label="Video">
              <span className="ec-label flex items-center px-3">Video</span>
              <DisplayKey icon={<Play size={14} />} label="Play" onClick={() => props.onVideo('play')} />
              <DisplayKey icon={<Pause size={14} />} label="Pause" onClick={() => props.onVideo('pause')} />
              <DisplayKey icon={<RotateCcw size={14} />} label="Restart" onClick={() => props.onVideo('restart')} />
            </div>
          )}
        </div>
      </section>

      <UpNext nextPage={nextPage} pdfUrl={media?.pdfUrl ?? null} word={word} item={nextItem} />

      {props.children}
    </div>
  );
});

/** One key in the display toolbar: icon + label, with a state word when it is on. */
function DisplayKey({ icon, label, active, hint, onClick, title }: { icon: ReactNode; label: string; active?: boolean; hint?: string; onClick: () => void; title?: string }) {
  return (
    <button className="ec-display-key" aria-pressed={active} onClick={onClick} title={title ?? label} aria-label={label}>
      {icon}
      <span className="ec-dk-label">{label}</span>
      {active ? <span className="ec-key-on">On</span> : hint ? <span className="ec-dk-hint"><KeyHint combo={hint} /></span> : null}
    </button>
  );
}

/**
 * Black Screen, next to the picture it blanks. Off: "Black screen". Armed (two-click
 * setting): "Click again". On: the key turns black and reads "Black screen · ON".
 */
function BlackKey({ active, confirm, hint, onPress }: { active: boolean; confirm: boolean; hint?: string; onPress: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => setArmed(false), [active]);
  const press = () => {
    if (!active && confirm && !armed) {
      setArmed(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    onPress();
  };
  return (
    <button
      className="ec-display-key ec-black-key"
      data-state={active ? 'on' : armed ? 'armed' : 'off'}
      aria-pressed={active}
      onClick={press}
      title={active ? 'Show the picture again' : 'Black screen'}
      aria-label={active ? 'Black screen is on — show the picture again' : armed ? 'Click again to go black' : 'Black screen'}
    >
      {active ? <MonitorPlay size={16} /> : <MonitorOff size={16} />}
      <span key={active ? 'on' : armed ? 'armed' : 'off'} className="ec-text-swap whitespace-nowrap">
        {armed ? 'Click again for black' : 'Black screen'}
      </span>
      {active ? <span className="ec-key-on">On</span> : !armed && hint ? <span className="ec-dk-hint"><KeyHint combo={hint} /></span> : null}
    </button>
  );
}

/** What the audience will see next: the next slide, or the next item in the Flow. */
function UpNext({ nextPage, pdfUrl, word, item }: { nextPage: number | null; pdfUrl: string | null; word: string; item: QueueItem | null }) {
  const Word = word[0].toUpperCase() + word.slice(1);
  return (
    <section aria-label="Up next" className="ec-upnext">
      <h3 className="ec-label mb-2.5">Up next</h3>
      {!nextPage && !item ? (
        <p className="t-support">Nothing — this is the last item in the Flow.</p>
      ) : (
        <div key={nextPage ? `p${nextPage}` : item!.id} className="ec-text-swap flex items-center gap-4">
          <span className="ec-upnext-thumb relative aspect-video shrink-0 overflow-hidden rounded-[var(--radius-media)] bg-black">
            {nextPage && pdfUrl ? <PdfThumb url={pdfUrl} page={nextPage} width={240} className="h-full w-full" /> : item ? <ItemPicture item={item} /> : null}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[var(--text-section)] font-semibold text-white">{nextPage ? `${Word} ${nextPage}` : itemLabel(item!)}</span>
            <span className="t-support mt-1 block truncate">{nextPage ? 'Same presentation · Next moves here' : itemDetail(item!)}</span>
          </span>
        </div>
      )}
    </section>
  );
}

/**
 * The program monitor. With mouse controls on, the wheel turns slides (one step per
 * gesture, however fast the trackpad scrolls) and a click moves on.
 */
function Monitor({ onAir, mouse, onNext, onPrevious, children }: { onAir: boolean; mouse: boolean; onNext?: () => void; onPrevious?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useRef({ onNext, onPrevious });
  nav.current = { onNext, onPrevious };

  useEffect(() => {
    const el = ref.current;
    if (!el || !mouse) return;
    let travel = 0;
    let quietUntil = 0;
    let settle = 0;
    // Non-passive, so the page does not scroll while the pointer is over the picture.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      window.clearTimeout(settle);
      settle = window.setTimeout(() => (travel = 0), 180);
      if (now < quietUntil) return;
      travel += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(travel) < 40) return;
      (travel > 0 ? nav.current.onNext : nav.current.onPrevious)?.();
      travel = 0;
      quietUntil = now + 350;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(settle);
    };
  }, [mouse]);

  return (
    <div
      ref={ref}
      className={cn('ec-monitor ec-monitor-docked relative aspect-video w-full', onAir && 'ec-onair', mouse && 'cursor-pointer')}
      onClick={mouse ? () => nav.current.onNext?.() : undefined}
      title={mouse ? 'Click for next · scroll to move through slides' : undefined}
    >
      {children}
    </div>
  );
}
