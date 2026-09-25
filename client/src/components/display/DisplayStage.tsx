import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Presentation } from 'lucide-react';
import type { DisplaySnapshot, PublicMedia, Screen, TimerSnapshot } from '../../types';
import { formatClock, formatEventDate } from '../../lib/format';
import { timerTone } from '../../lib/timer';
import { cn } from '../../lib/cn';
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
 * units, so it scales from a thumbnail to a 4K projector identically.
 */
export function DisplayStage({ display, timer, timerRemaining = 0, variant, videoCommand }: DisplayStageProps) {
  // The countdown is visible when the operator enables "Show timer on display":
  // large and centred on special screens, as a corner badge over slides.
  const timerVisible = !!timer && timer.status !== 'idle' && timer.showOnDisplay;
  const screen = display.mode === 'screen' ? display.screen : null;
  const screenShowsTimer = timerVisible && display.mode === 'screen';
  const cornerTimer = timerVisible && (display.mode === 'media' || display.mode === 'logo');
  const overlay = display.overlay;
  const showOverlay = overlay?.visible && overlay.media && !overlay.media.missing && (display.mode === 'media' || display.mode === 'screen');

  // Content key: changing it cross-fades. Page flips and black are instant.
  const contentKey =
    display.mode === 'media' ? `m:${display.media?.id ?? 'none'}` : display.mode === 'screen' ? `s:${screen?.id ?? 'wait'}` : display.mode;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black text-white" style={{ containerType: 'size' }}>
      {display.mode === 'black' ? null : (
        <div key={contentKey} className="ec-fade-in absolute inset-0">
          {display.mode === 'screen' ? (
            <ScreenView display={display} screen={screen} timer={screenShowsTimer ? timer! : null} remaining={timerRemaining} variant={variant} hideLogo={!!showOverlay} />
          ) : display.mode === 'logo' ? (
            <LogoScreen display={display} />
          ) : display.media ? (
            <MediaContent media={display.media} title={display.title} display={display} variant={variant} videoCommand={videoCommand} />
          ) : (
            <ScreenView display={display} screen={display.screen} timer={null} remaining={0} variant={variant} />
          )}
        </div>
      )}

      {showOverlay && (
        <img
          src={overlay.media!.url}
          alt=""
          className={cn('pointer-events-none absolute object-contain', overlayPositionClass[overlay.position] ?? overlayPositionClass['top-right'])}
          style={{ width: `${overlay.size}cqw`, maxHeight: `${overlay.size * 1.6}cqh`, opacity: overlay.opacity / 100 }}
        />
      )}

      {cornerTimer && timer && (
        <div className="absolute right-[2.5cqw] bottom-[2.5cqw]">
          <TimerBadge timer={timer} remaining={timerRemaining} />
        </div>
      )}
    </div>
  );
}

const overlayPositionClass: Record<string, string> = {
  'top-left': 'top-[3cqh] left-[2.5cqw]',
  'top-right': 'top-[3cqh] right-[2.5cqw]',
  'bottom-left': 'bottom-[3cqh] left-[2.5cqw]',
  'bottom-right': 'bottom-[3cqh] right-[2.5cqw]',
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

/** Accent colours per screen style. */
const styleTheme: Record<string, { a: string; b: string; label: string }> = {
  'please-wait': { a: 'rgba(37,99,235,.45)', b: 'rgba(124,58,237,.35)', label: '#93c5fd' },
  technical: { a: 'rgba(245,158,11,.40)', b: 'rgba(239,68,68,.28)', label: '#fcd34d' },
  break: { a: 'rgba(20,184,166,.40)', b: 'rgba(37,99,235,.30)', label: '#5eead4' },
  starting: { a: 'rgba(14,165,233,.42)', b: 'rgba(16,185,129,.28)', label: '#7dd3fc' },
  'coming-up': { a: 'rgba(99,102,241,.45)', b: 'rgba(236,72,153,.28)', label: '#c4b5fd' },
  thanks: { a: 'rgba(168,85,247,.42)', b: 'rgba(236,72,153,.30)', label: '#f0abfc' },
  custom: { a: 'rgba(71,85,105,.45)', b: 'rgba(37,99,235,.25)', label: '#cbd5e1' },
};

function AnimatedBackdrop({ style }: { style: string }) {
  const theme = styleTheme[style] ?? styleTheme.custom;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#05070c]">
      <div className="ec-drift absolute -inset-[20%]" style={{ background: `radial-gradient(circle at 25% 30%, ${theme.a}, transparent 45%)` }} />
      <div className="ec-drift-reverse absolute -inset-[20%]" style={{ background: `radial-gradient(circle at 75% 70%, ${theme.b}, transparent 45%)` }} />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '6cqw 6cqw' }}
      />
    </div>
  );
}

/** Please Wait / Technical Difficulty / Break / Thank You / custom announcements. */
function ScreenView({
  display,
  screen,
  timer,
  remaining,
  variant,
  hideLogo,
}: {
  display: DisplaySnapshot;
  screen: Screen | null;
  timer: TimerSnapshot | null;
  remaining: number;
  variant: 'display' | 'preview';
  /** The logo overlay is already on screen: don't show the logo twice. */
  hideLogo?: boolean;
}) {
  const style = screen?.style ?? 'please-wait';
  const theme = styleTheme[style] ?? styleTheme.custom;
  const bg = screen?.background && !screen.background.missing ? screen.background : null;
  const tone = timer ? timerTone(timer, remaining) : 'idle';

  return (
    <div className="absolute inset-0 flex items-center justify-center text-center">
      {bg ? (
        <>
          {bg.kind === 'video' ? (
            <video src={bg.url} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline />
          ) : (
            <img src={bg.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/55" />
        </>
      ) : (
        <AnimatedBackdrop style={style} />
      )}
      <div className="relative flex flex-col items-center px-[7cqw]">
        {display.logo && !display.logo.missing && !bg && !hideLogo && (
          <img src={display.logo.url} alt="" className="ec-rise mb-[3cqh] h-[13cqh] w-auto object-contain opacity-90" />
        )}
        <div className="ec-rise text-[1.5cqw] font-semibold tracking-[0.42em] uppercase" style={{ color: theme.label, animationDelay: '60ms' }}>
          {display.eventName}
        </div>
        <h1 className="ec-rise mt-[2.2cqh] text-[6.8cqw] leading-[1.04] font-extrabold tracking-tight text-balance" style={{ animationDelay: '120ms' }}>
          {screen?.title ?? 'Please Wait'}
        </h1>
        {screen?.subtitle && (
          <p className="ec-rise mt-[2.6cqh] max-w-[70cqw] text-[2.6cqw] text-balance text-slate-200" style={{ animationDelay: '200ms' }}>
            {screen.subtitle}
          </p>
        )}
        {timer ? (
          <div
            className={cn(
              'ec-rise mt-[4cqh] rounded-[1.5cqw] px-[3cqw] py-[1cqh] font-mono text-[9cqw] leading-none font-bold tabular-nums ring-1',
              tone === 'finished' ? 'animate-pulse-soft bg-red-600/80 ring-red-300/40' : tone === 'warning' ? 'bg-amber-400/90 text-amber-950 ring-amber-200/40' : 'bg-white/10 ring-white/15',
            )}
            style={{ animationDelay: '260ms' }}
          >
            {tone === 'finished' ? '00:00' : formatClock(remaining)}
          </div>
        ) : (
          <div className="mt-[5cqh] flex gap-[1cqw]" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="animate-pulse-soft h-[0.8cqw] w-[0.8cqw] rounded-full" style={{ animationDelay: `${i * 0.2}s`, background: theme.label }} />
            ))}
          </div>
        )}
        {variant === 'preview' && !screen && <p className="mt-[3cqh] text-[1.6cqw] text-slate-500">Nothing programmed</p>}
      </div>
    </div>
  );
}

function LogoScreen({ display }: { display: DisplaySnapshot }) {
  if (display.logo && !display.logo.missing) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <img src={display.logo.url} alt={display.eventName} className="max-h-[70%] max-w-[70%] object-contain" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center text-center">
      <AnimatedBackdrop style="please-wait" />
      <div className="relative">
        <h1 className="px-[8cqw] text-[8cqw] leading-none font-black tracking-tight text-balance">{display.eventName}</h1>
        <p className="mt-[2cqh] text-[1.6cqw] tracking-[0.4em] text-slate-400 uppercase">{formatEventDate(display.eventDate)}</p>
      </div>
    </div>
  );
}

function MissingMedia({ variant, display }: { variant: 'display' | 'preview'; display: DisplaySnapshot }) {
  // The audience never sees an error: fall back to the Please Wait screen.
  if (variant === 'display') return <ScreenView display={display} screen={display.screen} timer={null} remaining={0} variant={variant} />;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] bg-red-950/40 text-center text-red-200">
      <AlertTriangle className="h-[12cqh] w-[12cqh]" />
      <p className="text-[3.5cqw] font-semibold">Media file no longer exists.</p>
    </div>
  );
}

/** Shown for PowerPoint files that have no slides yet (converting, or LibreOffice missing). */
function PresentationCard({ media, title, variant }: { media: PublicMedia; title: string | null; variant: 'display' | 'preview' }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <AnimatedBackdrop style="coming-up" />
      <div className="relative flex flex-col items-center px-[8cqw]">
        <Presentation className="h-[12cqh] w-[12cqh] text-orange-300" strokeWidth={1.5} />
        <h1 className="mt-[4cqh] text-[5.5cqw] leading-[1.1] font-bold tracking-tight text-balance">{title || media.name}</h1>
        {variant === 'preview' && (
          <p className="mt-[2.5cqh] flex items-center gap-[1cqw] text-[1.8cqw] text-slate-400">
            <Loader2 className="h-[2.2cqw] w-[2.2cqw] animate-spin" /> Slides not available yet
          </p>
        )}
      </div>
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
      return <img src={media.url} alt={title ?? media.name} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-contain" />;
    case 'video':
      return <VideoView media={media} variant={variant} command={videoCommand} />;
    case 'presentation':
      return <PresentationCard media={media} title={title} variant={variant} />;
    default:
      return <MissingMedia variant={variant} display={display} />;
  }
}
