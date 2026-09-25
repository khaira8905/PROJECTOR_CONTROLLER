import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { DisplaySnapshot, PublicMedia, TimerSnapshot } from '../../types';
import { cn } from '../../lib/cn';
import { LogoScene, ScreenScene } from './ScreenScene';
import { StageTransition, usePresence, type LayerKind } from './motion';
import { TimerBadge } from './TimerBadge';

// pdf.js is large: load it only when a PDF/slide deck is actually shown.
const PdfView = lazy(() => import('./PdfView').then((m) => ({ default: m.PdfView })));

export interface VideoCommand {
  action: 'play' | 'pause' | 'restart';
  nonce: number;
}

interface DisplayStageProps {
  display: DisplaySnapshot;
  timer?: TimerSnapshot | null;
  timerRemaining?: number;
  /** "display" = the real projector output; "preview" = the operator's program monitor. */
  variant: 'display' | 'preview';
  videoCommand?: VideoCommand | null;
}

/**
 * Renders exactly what the audience sees for a display snapshot. The same component
 * powers the projector page and the dashboard preview; all sizes use container query
 * units, so it scales from a thumbnail to a 4K projector identically — animations included.
 */
export function DisplayStage({ display, timer, timerRemaining = 0, variant, videoCommand }: DisplayStageProps) {
  // The countdown is visible when the operator enables "Show timer on display":
  // large on special screens, as a corner badge over slides.
  const timerVisible = !!timer && timer.status !== 'idle' && timer.showOnDisplay;
  const screen = display.mode === 'screen' ? display.screen : null;
  const screenShowsTimer = timerVisible && display.mode === 'screen';
  const cornerTimer = usePresence(timerVisible && (display.mode === 'media' || display.mode === 'logo'), 350);

  const overlay = display.overlay;
  const overlayOn = !!(overlay?.visible && overlay.media && !overlay.media.missing && (display.mode === 'media' || display.mode === 'screen'));
  const overlayPresence = usePresence(overlayOn, 400);
  // Remember the last overlay so it can fade out even after it's been switched off.
  const lastOverlay = useRef(overlay);
  if (overlayOn) lastOverlay.current = overlay;
  const shownOverlay = overlayOn ? overlay : lastOverlay.current;

  // One layer per piece of content: changing it cross-fades; page flips happen inside PdfView.
  let kind: LayerKind = display.mode;
  let layerKey: string = display.mode;
  if (display.mode === 'media') layerKey = display.media ? `m:${display.media.id}` : `s:${display.screen?.id ?? 'wait'}`;
  if (display.mode === 'media' && !display.media) kind = 'screen';
  if (display.mode === 'screen') layerKey = `s:${screen?.id ?? 'wait'}`;

  return (
    // The console's white theme redefines "white" as dark text; the projector output always uses real white.
    <div className="absolute inset-0 overflow-hidden bg-black text-white" style={{ containerType: 'size', '--color-white': '#fff' } as CSSProperties}>
      <StageTransition layerKey={layerKey} kind={kind}>
        {display.mode === 'black' ? null : display.mode === 'screen' ? (
          <ScreenScene
            screen={screen ?? { title: 'Please Wait', subtitle: '', style: 'please-wait' }}
            eventName={display.eventName}
            eventDate={display.eventDate}
            logo={display.logo}
            hideLogo={overlayOn}
            timer={screenShowsTimer ? timer : null}
            remaining={timerRemaining}
          />
        ) : display.mode === 'logo' ? (
          <LogoScene logo={display.logo} eventName={display.eventName} eventDate={display.eventDate} />
        ) : display.media ? (
          <MediaContent media={display.media} title={display.title} display={display} variant={variant} videoCommand={videoCommand} />
        ) : (
          <FallbackScreen display={display} />
        )}
      </StageTransition>

      {overlayPresence.mounted && shownOverlay?.media && (
        <img
          src={shownOverlay.media.url}
          alt=""
          className={cn(
            'pointer-events-none absolute object-contain drop-shadow-[0_0.4cqw_1.2cqw_rgba(0,0,0,0.45)]',
            overlayPositionClass[shownOverlay.position] ?? overlayPositionClass['top-right'],
            overlayPresence.leaving ? 'ec-overlay-out' : 'ec-overlay-in',
          )}
          style={
            {
              width: `${shownOverlay.size}cqw`,
              maxHeight: `${shownOverlay.size * 1.6}cqh`,
              opacity: shownOverlay.opacity / 100,
              '--overlay-opacity': shownOverlay.opacity / 100,
            } as CSSProperties
          }
        />
      )}

      {cornerTimer.mounted && timer && (
        <div className={cn('absolute right-[2.5cqw] bottom-[2.5cqw]', cornerTimer.leaving ? 'ec-overlay-out' : 'ec-badge-in')}>
          <TimerBadge timer={timer} remaining={timerRemaining} />
        </div>
      )}
    </div>
  );
}

const overlayPositionClass: Record<string, string> = {
  'top-left': 'top-[3cqh] left-[2.5cqw] origin-top-left',
  'top-right': 'top-[3cqh] right-[2.5cqw] origin-top-right',
  'bottom-left': 'bottom-[3cqh] left-[2.5cqw] origin-bottom-left',
  'bottom-right': 'bottom-[3cqh] right-[2.5cqw] origin-bottom-right',
  center: 'inset-0 m-auto',
};

function FallbackScreen({ display }: { display: DisplaySnapshot }) {
  return (
    <ScreenScene
      screen={display.screen ?? { title: 'Please Wait', subtitle: '', style: 'please-wait' }}
      eventName={display.eventName}
      eventDate={display.eventDate}
      logo={display.logo}
    />
  );
}

function MissingMedia({ variant, display }: { variant: 'display' | 'preview'; display: DisplaySnapshot }) {
  // The audience never sees an error: fall back to the Please Wait screen.
  if (variant === 'display') return <FallbackScreen display={display} />;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] bg-red-950/40 text-center text-red-200">
      <AlertTriangle className="h-[12cqh] w-[12cqh]" />
      <p className="text-[3.5cqw] font-semibold">Media file no longer exists.</p>
    </div>
  );
}

function VideoView({ media, variant, command }: { media: PublicMedia; variant: 'display' | 'preview'; command?: VideoCommand | null }) {
  const ref = useRef<HTMLVideoElement>(null);

  // Autoplay with sound when the browser allows it; otherwise fall back to muted playback.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = variant === 'preview';
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [media.url, variant]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !command) return;
    if (command.action === 'pause') video.pause();
    else {
      if (command.action === 'restart') video.currentTime = 0;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }, [command]);

  return <video ref={ref} src={media.url} className="absolute inset-0 h-full w-full object-contain" playsInline preload="auto" />;
}

function MediaContent({
  media,
  title,
  display,
  variant,
  videoCommand,
}: {
  media: PublicMedia;
  title: string | null;
  display: DisplaySnapshot;
  variant: 'display' | 'preview';
  videoCommand?: VideoCommand | null;
}) {
  const [failed, setFailed] = useState(false);
  if (media.missing || failed) return <MissingMedia variant={variant} display={display} />;

  // PDFs and converted PowerPoint decks: one page/slide at a time.
  if (media.pdfUrl) {
    return (
      <Suspense fallback={null}>
        <PdfView url={media.pdfUrl} page={display.page} fallback={<MissingMedia variant={variant} display={display} />} />
      </Suspense>
    );
  }
  switch (media.kind) {
    case 'image':
      return <img src={media.url} alt={title ?? media.name} onError={() => setFailed(true)} className="ec-kenburns absolute inset-0 h-full w-full object-contain" />;
    case 'video':
      return <VideoView media={media} variant={variant} command={videoCommand} />;
    case 'presentation':
      // A PowerPoint without slides yet (converting, or LibreOffice missing): a title card.
      return (
        <ScreenScene
          screen={{ title: title || media.name, subtitle: '', style: 'custom' }}
          eventName={display.eventName}
          note={
            variant === 'preview' ? (
              <span className="inline-flex items-center gap-[0.8cqw]">
                <Loader2 className="h-[2cqw] w-[2cqw] animate-spin" /> Slides not available yet
              </span>
            ) : null
          }
        />
      );
    default:
      return <MissingMedia variant={variant} display={display} />;
  }
}
