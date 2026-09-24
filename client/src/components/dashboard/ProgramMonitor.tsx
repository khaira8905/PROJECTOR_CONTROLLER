import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play, RotateCcw } from 'lucide-react';
import { DisplayStage, type VideoCommand } from '../display/DisplayStage';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { MediaIcon } from '../MediaIcon';
import type { DisplaySnapshot, QueueItem, TimerSnapshot } from '../../types';

interface ProgramMonitorProps {
  display: DisplaySnapshot | null;
  timer: TimerSnapshot | null;
  timerRemaining: number;
  currentItem: QueueItem | null;
  videoCommand: VideoCommand | null;
  pdfPageCount: number | null;
  onPdfPageCount: (count: number) => void;
  onCommand: (cmd: 'video-play' | 'video-pause' | 'video-restart' | 'page-prev' | 'page-next') => void;
  onOpenExternally: (mediaId: string) => void;
}

const modeBadge = {
  media: <Badge tone="live" dot>On air</Badge>,
  black: <Badge tone="neutral">Black screen</Badge>,
  waiting: <Badge tone="info">Waiting screen</Badge>,
  logo: <Badge tone="violet">Logo</Badge>,
} as const;

/** A live, scaled copy of exactly what the projector is showing. */
export function ProgramMonitor({ display, timer, timerRemaining, currentItem, videoCommand, pdfPageCount, onPdfPageCount, onCommand, onOpenExternally }: ProgramMonitorProps) {
  const media = display?.mode === 'media' ? display.media : null;
  const title = display?.mode === 'media' ? display.title : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">Current display</span>
          {display && modeBadge[display.mode]}
          {display?.adHocMediaId && display.mode === 'media' && <Badge tone="warning">From library</Badge>}
        </div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
        {display ? (
          <DisplayStage display={display} timer={timer} timerRemaining={timerRemaining} variant="preview" videoCommand={videoCommand} onPdfPageCount={onPdfPageCount} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Connecting…</div>
        )}
        {display?.mode === 'black' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-md border border-white/10 px-3 py-1 font-mono text-xs tracking-widest text-slate-500">BLACK</span>
          </div>
        )}
      </div>

      {/* What is programmed, with content-specific controls. */}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl bg-console-850 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          {media ? <MediaIcon kind={media.kind} size={15} /> : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{title ?? currentItem?.title ?? currentItem?.media.name ?? 'Nothing programmed'}</p>
            <p className="truncate text-xs text-slate-500">{media ? media.name : display?.mode === 'media' ? '' : 'Projector is not showing content'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {media?.kind === 'video' && (
            <>
              <Button size="sm" variant="ghost" icon={<Play size={14} />} onClick={() => onCommand('video-play')}>
                Play
              </Button>
              <Button size="sm" variant="ghost" icon={<Pause size={14} />} onClick={() => onCommand('video-pause')}>
                Pause
              </Button>
              <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => onCommand('video-restart')}>
                Restart
              </Button>
            </>
          )}
          {media?.kind === 'pdf' && display && (
            <>
              <Button size="icon-sm" variant="ghost" aria-label="Previous page" disabled={display.page <= 1} onClick={() => onCommand('page-prev')}>
                <ChevronLeft size={16} />
              </Button>
              <span className="min-w-20 text-center font-mono text-xs text-slate-300">
                Page {Math.min(display.page, pdfPageCount ?? display.page)} / {pdfPageCount ?? '…'}
              </span>
              <Button size="icon-sm" variant="ghost" aria-label="Next page" disabled={pdfPageCount !== null && display.page >= pdfPageCount} onClick={() => onCommand('page-next')}>
                <ChevronRight size={16} />
              </Button>
              <span className="ml-1 hidden gap-1 text-[11px] text-slate-500 xl:flex">
                <Kbd>PgUp</Kbd>
                <Kbd>PgDn</Kbd>
              </span>
            </>
          )}
          {media?.kind === 'presentation' && (
            <Button size="sm" variant="warning" icon={<ExternalLink size={14} />} onClick={() => onOpenExternally(media.id)}>
              Open in PowerPoint
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TransportControls({ onPrevious, onNext, canPrevious, canNext }: { onPrevious: () => void; onNext: () => void; canPrevious: boolean; canNext: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button size="lg" variant="secondary" onClick={onPrevious} disabled={!canPrevious} className="h-16 text-lg" icon={<ChevronLeft size={22} />}>
        Previous <Kbd className="ml-1">←</Kbd>
      </Button>
      <Button size="lg" variant="primary" onClick={onNext} disabled={!canNext} className="h-16 text-lg">
        Next <Kbd className="ml-1 border-slate-900/20 bg-slate-900/10 text-slate-900">→</Kbd>
        <ChevronRight size={22} />
      </Button>
    </div>
  );
}
