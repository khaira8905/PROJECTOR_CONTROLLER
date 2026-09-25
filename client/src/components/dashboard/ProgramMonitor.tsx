import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play, RotateCcw } from 'lucide-react';
import { DisplayStage, type VideoCommand } from '../display/DisplayStage';
import { PdfThumb } from '../PdfThumb';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { MediaIcon } from '../MediaIcon';
import { cn } from '../../lib/cn';
import { pageWord } from '../../lib/flow';
import { revealWithin } from '../../lib/scroll';
import type { DisplaySnapshot, TimerSnapshot } from '../../types';

interface ProgramMonitorProps {
  display: DisplaySnapshot | null;
  timer: TimerSnapshot | null;
  timerRemaining: number;
  videoCommand: VideoCommand | null;
  jumpRef: React.RefObject<HTMLInputElement | null>;
  onVideo: (action: VideoCommand['action']) => void;
  onGoToPage: (page: number) => void;
  onOpenExternally: (mediaId: string) => void;
}

const modeBadge = {
  media: (
    <Badge tone="live" dot>
      On air
    </Badge>
  ),
  screen: <Badge tone="info">Screen</Badge>,
  black: <Badge tone="neutral">Black screen</Badge>,
  logo: <Badge tone="violet">Logo</Badge>,
} as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** A live, scaled copy of exactly what the projector is showing, plus content controls. */
export function ProgramMonitor({ display, timer, timerRemaining, videoCommand, jumpRef, onVideo, onGoToPage, onOpenExternally }: ProgramMonitorProps) {
  const media = display?.media ?? null;
  const paged = !!media?.pdfUrl && !!media.pageCount;
  const word = pageWord(media);

  let heading = 'Nothing programmed';
  if (display?.mode === 'screen') heading = display.screen?.title ?? 'Please Wait';
  else if (display?.mode === 'black') heading = 'Black screen';
  else if (display?.mode === 'logo') heading = 'Event logo';
  else if (media) heading = display?.title ?? media.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">Current output</span>
        {display && modeBadge[display.mode]}
        {display?.adHocMediaId && display.mode === 'media' && <Badge tone="warning">From library</Badge>}
        {display?.overlay?.visible && <Badge tone="violet">Logo overlay</Badge>}
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
        {display ? (
          <DisplayStage display={display} timer={timer} timerRemaining={timerRemaining} variant="preview" videoCommand={videoCommand} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Connecting…</div>
        )}
        {display?.mode === 'black' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-md border border-white/10 px-3 py-1 font-mono text-xs tracking-widest text-slate-500">BLACK</span>
          </div>
        )}
      </div>

      {/* "Speaker 1 — Slide 07 / 24" and content-specific controls. */}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl bg-console-850 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          {media && display?.mode === 'media' && <MediaIcon kind={media.kind} size={15} />}
          <p className="min-w-0 truncate text-base font-semibold text-white">
            {heading}
            {paged && display && (
              <span className="ml-2 font-mono text-sm font-medium text-slate-400">
                — {word[0].toUpperCase() + word.slice(1)} {pad(display.page)} / {pad(media!.pageCount!)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {media?.kind === 'video' && (
            <>
              <Button size="sm" variant="ghost" icon={<Play size={14} />} onClick={() => onVideo('play')}>
                Play
              </Button>
              <Button size="sm" variant="ghost" icon={<Pause size={14} />} onClick={() => onVideo('pause')}>
                Pause
              </Button>
              <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => onVideo('restart')}>
                Restart
              </Button>
            </>
          )}
          {paged && display && <JumpToPage key={media!.id} jumpRef={jumpRef} count={media!.pageCount!} current={display.page} onGo={onGoToPage} word={word} />}
          {media?.kind === 'presentation' && (
            <Button size="sm" variant="ghost" icon={<ExternalLink size={14} />} onClick={() => onOpenExternally(media.id)} title="Open the original file in PowerPoint">
              PowerPoint
            </Button>
          )}
        </div>
      </div>

      {paged && display && <SlideStrip key={media!.pdfUrl!} url={media!.pdfUrl!} count={media!.pageCount!} current={display.page} range={display.range} live={display.mode === 'media'} onGo={onGoToPage} />}
    </div>
  );
}

function JumpToPage({ count, current, onGo, word, jumpRef }: { count: number; current: number; onGo: (p: number) => void; word: string; jumpRef: React.RefObject<HTMLInputElement | null> }) {
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= count) {
      onGo(n);
      setValue('');
      jumpRef.current?.blur();
    }
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <Button size="icon-sm" variant="ghost" aria-label={`Previous ${word}`} disabled={current <= 1} onClick={() => onGo(current - 1)}>
        <ChevronLeft size={16} />
      </Button>
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        Go to
        <input
          ref={jumpRef}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          placeholder={String(current)}
          inputMode="numeric"
          aria-label={`Jump to ${word}`}
          className="h-8 w-14 rounded-md border border-white/10 bg-console-950 px-2 text-center font-mono text-sm text-white focus:border-sky-400 focus:outline-none"
        />
      </label>
      <Button size="icon-sm" variant="ghost" aria-label={`Next ${word}`} disabled={current >= count} onClick={() => onGo(current + 1)}>
        <ChevronRight size={16} />
      </Button>
      <Kbd className="hidden xl:inline-flex">G</Kbd>
    </form>
  );
}

/** Clickable thumbnails of every slide/page; the Show Flow range is highlighted. */
function SlideStrip({
  url,
  count,
  current,
  range,
  live,
  onGo,
}: {
  url: string;
  count: number;
  current: number;
  range: { start: number; end: number } | null;
  live: boolean;
  onGo: (p: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    revealWithin(strip.current?.querySelector<HTMLElement>(`[data-page="${current}"]`), 'x', true);
  }, [current]);

  return (
    <div ref={strip} className="scroll-thin flex gap-2 overflow-x-auto pb-1">
      {Array.from({ length: count }, (_, i) => i + 1).map((page) => {
        const inRange = !range || (page >= range.start && page <= range.end);
        const active = page === current;
        return (
          <button
            key={page}
            data-page={page}
            onClick={() => onGo(page)}
            title={`Show ${page}`}
            className={cn(
              'group relative w-28 shrink-0 overflow-hidden rounded-lg ring-2 transition-[box-shadow,transform,opacity] duration-200 ease-out hover:-translate-y-0.5',
              active ? (live ? 'ring-red-500' : 'ring-sky-400') : 'ring-transparent hover:ring-white/30',
              !inRange && 'opacity-40',
            )}
          >
            <PdfThumb url={url} page={page} width={112} className="aspect-video w-full" />
            <span className={cn('absolute bottom-1 left-1 rounded px-1 font-mono text-[10px]', active ? 'bg-red-600 text-white' : 'bg-black/70 text-slate-300')}>{page}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TransportControls({ onPrevious, onNext, canPrevious, canNext }: { onPrevious: () => void; onNext: () => void; canPrevious: boolean; canNext: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        size="lg"
        variant="secondary"
        onClick={onPrevious}
        disabled={!canPrevious}
        className="h-16 text-lg"
        icon={<ChevronLeft size={22} className="transition-transform duration-200 group-hover/btn:-translate-x-1" />}
      >
        Previous <Kbd className="ml-1">←</Kbd>
      </Button>
      <Button size="lg" variant="primary" onClick={onNext} disabled={!canNext} className="h-16 text-lg">
        Next <Kbd className="ml-1 border-slate-900/20 bg-slate-900/10 text-slate-900">→</Kbd>
        <ChevronRight size={22} className="transition-transform duration-200 group-hover/btn:translate-x-1" />
      </Button>
    </div>
  );
}
