import { memo, useEffect, useRef, type ReactNode } from 'react';
import { ExternalLink, Maximize, Pause, Play, RotateCcw } from 'lucide-react';
import { DisplayStage, type VideoCommand } from '../display/DisplayStage';
import { PdfThumb } from '../PdfThumb';
import { Button } from '../ui/Button';
import { ItemPicture } from './ControlDeck';
import { cn } from '../../lib/cn';
import { itemDetail, itemLabel, pageWord } from '../../lib/flow';
import type { DisplaySnapshot, QueueItem, TimerSnapshot } from '../../types';

interface StagePaneProps {
  display: DisplaySnapshot | null;
  timer: TimerSnapshot | null;
  videoCommand: VideoCommand | null;
  /** A projector window is connected. */
  live: boolean;
  showPreview: boolean;
  nextItem: QueueItem | null;
  canNext: boolean;
  canPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onVideo: (action: VideoCommand['action']) => void;
  onOpenExternally: (mediaId: string) => void;
  onFullscreen: () => void;
  /** Scroll over the picture to change slides, click it for the next one. */
  mouseControls: boolean;
  /** "Open in PowerPoint" only works on the computer that runs EventControl. */
  canOpenExternally: boolean;
  /** Quick Selection, rendered at the bottom. */
  children?: ReactNode;
}

/**
 * The supporting column: the picture the audience sees, what comes next, and the quick
 * shortcuts. The controls that move the show live in the primary column (ControlDeck).
 */
export const StagePane = memo(function StagePane(props: StagePaneProps) {
  const { display, live, nextItem } = props;
  const media = display?.mode === 'media' ? display.media : null;
  const paged = !!media?.pdfUrl && !!media.pageCount;
  const page = display?.page ?? 1;
  const lastPage = display?.range ? display.range.end : (media?.pageCount ?? 0);
  const nextPage = paged && !display?.adHocMediaId && page < lastPage ? page + 1 : null;
  const word = pageWord(media);
  const onAir = live && !!display && display.mode !== 'black';

  return (
    <div className="ec-stage flex flex-col gap-4 px-5 py-4">
      <section aria-label="On the projector">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', onAir ? 'bg-[#e5484d]' : 'bg-slate-600')} aria-hidden />
          <h3 className="ec-label">{live ? (display?.mode === 'black' ? 'Projector · black' : 'Projector') : 'Projector offline'}</h3>
          <Button size="sm" variant="ghost" icon={<Maximize size={13} />} onClick={props.onFullscreen} className="-my-1 ml-auto text-[12px]" title="Ask the projector window to go fullscreen (F)">
            Fullscreen
          </Button>
        </div>
        {props.showPreview && (
          <Monitor onAir={onAir} mouse={props.mouseControls && !!display} onNext={props.canNext ? props.onNext : undefined} onPrevious={props.canPrevious ? props.onPrevious : undefined}>
            <div className="absolute inset-0 overflow-hidden rounded-[6px]">
              {display ? (
                <DisplayStage display={display} timer={props.timer} variant="preview" videoCommand={props.videoCommand} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#fff]/55">Connecting to the event…</div>
              )}
              {display?.mode === 'black' && (
                <span className="ec-fade-in absolute top-2 left-2 border border-[#fff]/20 bg-black/60 px-2 py-0.5 font-mono text-[10px] tracking-[0.3em] text-[#fff]/60">BLACK</span>
              )}
            </div>
          </Monitor>
        )}
        {(media?.kind === 'video' || (media?.kind === 'presentation' && props.canOpenExternally)) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {media.kind === 'video' && (
              <>
                <Button size="sm" variant="secondary" icon={<Play size={13} />} onClick={() => props.onVideo('play')}>
                  Play
                </Button>
                <Button size="sm" variant="secondary" icon={<Pause size={13} />} onClick={() => props.onVideo('pause')}>
                  Pause
                </Button>
                <Button size="sm" variant="secondary" icon={<RotateCcw size={13} />} onClick={() => props.onVideo('restart')}>
                  Restart
                </Button>
              </>
            )}
            {media.kind === 'presentation' && (
              <Button size="sm" variant="ghost" icon={<ExternalLink size={13} />} onClick={() => props.onOpenExternally(media.id)} title="Open the original file in PowerPoint (for animations and embedded video)">
                Open in PowerPoint
              </Button>
            )}
          </div>
        )}
      </section>

      <UpNext nextPage={nextPage} pdfUrl={media?.pdfUrl ?? null} word={word} item={nextItem} />

      {props.children}
    </div>
  );
});

/** What the audience will see next: the next slide, or the next item in the Flow. */
function UpNext({ nextPage, pdfUrl, word, item }: { nextPage: number | null; pdfUrl: string | null; word: string; item: QueueItem | null }) {
  const Word = word[0].toUpperCase() + word.slice(1);
  return (
    <section aria-label="Up next" className="ec-upnext">
      <h3 className="ec-label mb-2">Up next</h3>
      {!nextPage && !item ? (
        <p className="text-[13px] text-slate-500">Nothing — this is the last item in the Flow.</p>
      ) : (
        <div key={nextPage ? `p${nextPage}` : item!.id} className="ec-upnext-card ec-text-swap flex items-center gap-3">
          <span className="ec-upnext-thumb relative aspect-video w-[38%] max-w-[180px] shrink-0 overflow-hidden rounded-[4px] bg-black">
            {nextPage && pdfUrl ? <PdfThumb url={pdfUrl} page={nextPage} width={180} className="h-full w-full" /> : item ? <ItemPicture item={item} /> : null}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-slate-100">{nextPage ? `${Word} ${nextPage}` : itemLabel(item!)}</span>
            <span className="mt-0.5 block truncate text-[12px] text-slate-500">{nextPage ? 'Same presentation' : itemDetail(item!)}</span>
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
      className={cn('ec-monitor relative mx-auto aspect-video w-full', onAir && 'ec-onair', mouse && 'cursor-pointer')}
      style={{ maxWidth: 'calc(var(--preview-h, 40vh) * 16 / 9)' }}
      onClick={mouse ? () => nav.current.onNext?.() : undefined}
      title={mouse ? 'Click for next · scroll to move through slides' : undefined}
    >
      {children}
    </div>
  );
}
