import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Presentation } from 'lucide-react';
import type { DisplaySnapshot, PublicMedia, TimerSnapshot } from '../../types';
import { formatEventDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { TimerBadge } from './TimerBadge';

// pdf.js is large: load it only when a PDF is actually shown.
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
  onPdfPageCount?: (count: number) => void;
}

/**
 * Renders exactly what the audience sees for a display snapshot. The same component
 * powers the projector page and the dashboard preview; all sizes use container query
 * units, so it scales from a thumbnail to a 4K projector identically.
 */
export function DisplayStage({ display, timer, timerRemaining = 0, variant, videoCommand, onPdfPageCount }: DisplayStageProps) {
  const showTimer = !!timer && timer.showOnDisplay && timer.status !== 'idle' && display.mode !== 'black';

  return (
    <div className="absolute inset-0 overflow-hidden bg-black text-white" style={{ containerType: 'size' }}>
      {display.mode === 'black' ? null : display.mode === 'waiting' ? (
        <WaitingScreen display={display} />
      ) : display.mode === 'logo' ? (
        <LogoScreen display={display} />
      ) : display.media ? (
        <MediaContent
          key={display.media.id}
          media={display.media}
          title={display.title}
          display={display}
          variant={variant}
          videoCommand={videoCommand}
          onPdfPageCount={onPdfPageCount}
        />
      ) : (
        <WaitingScreen display={display} />
      )}

      {showTimer && timer && (
        <div className="absolute right-[2.5cqw] bottom-[2.5cqw]">
          <TimerBadge timer={timer} remaining={timerRemaining} />
        </div>
      )}
    </div>
  );
}

function Backdrop() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(circle at 18% 22%, rgba(37,99,235,.35), transparent 45%), radial-gradient(circle at 82% 78%, rgba(124,58,237,.32), transparent 45%), #05070c',
      }}
    />
  );
}

function WaitingScreen({ display }: { display: DisplaySnapshot }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <Backdrop />
      <div className="relative flex flex-col items-center px-[6cqw]">
        {display.logo && !display.logo.missing && (
          <img src={display.logo.url} alt="" className="mb-[3cqh] h-[16cqh] w-auto object-contain opacity-90" />
        )}
        <div className="text-[1.6cqw] font-semibold tracking-[0.4em] text-sky-300/80 uppercase">
          {formatEventDate(display.eventDate)}
        </div>
        <h1 className="mt-[2cqh] text-[6.5cqw] leading-[1.05] font-extrabold tracking-tight text-balance">{display.eventName}</h1>
        <p className="mt-[3cqh] text-[2.6cqw] text-slate-300">{display.waitingMessage}</p>
        <div className="mt-[5cqh] flex gap-[1cqw]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="animate-pulse-soft h-[0.8cqw] w-[0.8cqw] rounded-full bg-sky-400/70" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
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
  // No logo uploaded: a typographic event mark.
  return (
    <div className="absolute inset-0 flex items-center justify-center text-center">
      <Backdrop />
      <h1 className="relative px-[8cqw] text-[8cqw] leading-none font-black tracking-tight text-balance">{display.eventName}</h1>
    </div>
  );
}

function MissingMedia({ variant, display }: { variant: 'display' | 'preview'; display: DisplaySnapshot }) {
  // The audience never sees an error: fall back to the waiting screen.
  if (variant === 'display') return <WaitingScreen display={display} />;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqh] bg-red-950/40 text-center text-red-200">
      <AlertTriangle className="h-[12cqh] w-[12cqh]" />
      <p className="text-[3.5cqw] font-semibold">Media file no longer exists.</p>
    </div>
  );
}

function PresentationCard({ media, title }: { media: PublicMedia; title: string | null }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <Backdrop />
      <div className="relative flex flex-col items-center px-[8cqw]">
        <Presentation className="h-[12cqh] w-[12cqh] text-orange-300" strokeWidth={1.5} />
        <h1 className="mt-[4cqh] text-[5.5cqw] leading-[1.1] font-bold tracking-tight text-balance">{title || media.name}</h1>
        <p className="mt-[2.5cqh] text-[1.8cqw] tracking-[0.3em] text-slate-400 uppercase">Presentation</p>
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
  onPdfPageCount,
}: {
  media: PublicMedia;
  title: string | null;
  display: DisplaySnapshot;
  variant: 'display' | 'preview';
  videoCommand?: VideoCommand | null;
  onPdfPageCount?: (count: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (media.missing || failed) return <MissingMedia variant={variant} display={display} />;

  switch (media.kind) {
    case 'image':
      return <img src={media.url} alt={title ?? media.name} onError={() => setFailed(true)} className={cn('absolute inset-0 h-full w-full object-contain')} />;
    case 'video':
      return <VideoView media={media} variant={variant} command={videoCommand} />;
    case 'pdf':
      return (
        <Suspense fallback={null}>
          <PdfView url={media.url} page={display.page} onPageCount={onPdfPageCount} fallback={<MissingMedia variant={variant} display={display} />} />
        </Suspense>
      );
    case 'presentation':
      return <PresentationCard media={media} title={title} />;
    default:
      return <MissingMedia variant={variant} display={display} />;
  }
}
