import { memo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Maximize, Pause, Play, RotateCcw, StickyNote, Undo2 } from 'lucide-react';
import { DisplayStage, type VideoCommand } from '../display/DisplayStage';
import { PdfThumb } from '../PdfThumb';
import { MediaIcon } from '../MediaIcon';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { cn } from '../../lib/cn';
import { itemDetail, itemLabel, pageWord } from '../../lib/flow';
import type { DisplaySnapshot, QueueItem, TimerSnapshot } from '../../types';

interface StagePaneProps {
  display: DisplaySnapshot | null;
  timer: TimerSnapshot | null;
  /** Something other than the current Flow item is on screen (black, a quick screen, a library file). */
  offFlow: boolean;
  videoCommand: VideoCommand | null;
  /** A projector window is connected. */
  live: boolean;
  showPreview: boolean;
  currentItem: QueueItem | null;
  nextItem: QueueItem | null;
  canNext: boolean;
  canPrevious: boolean;
  /** Label for the Start button when nothing from the Flow has been shown yet. */
  startLabel: string | null;
  onStart: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onResume: () => void;
  onGoToPage: (page: number) => void;
  onVideo: (action: VideoCommand['action']) => void;
  onOpenExternally: (mediaId: string) => void;
  onFullscreen: () => void;
  onEditNotes: (item: QueueItem) => void;
  /** Quick Selection and the timer, rendered below the transport. */
  children?: ReactNode;
}

/**
 * What the audience sees and how to move on: the picture, Previous/Next, what comes
 * next, and the presenter's quick shortcuts. Deliberately secondary to the Flow.
 */
export const StagePane = memo(function StagePane(props: StagePaneProps) {
  const { display, live, currentItem, nextItem } = props;
  const media = display?.mode === 'media' ? display.media : null;
  const paged = !!media?.pdfUrl && !!media.pageCount;
  const word = pageWord(media);
  const Word = word[0].toUpperCase() + word.slice(1);
  const page = display?.page ?? 1;
  const count = media?.pageCount ?? 0;
  const lastPage = display?.range ? display.range.end : count;
  const nextPage = paged && !display?.adHocMediaId && page < lastPage ? page + 1 : null;

  const offFlow = props.offFlow;
  const onAir = live && !!display && display.mode !== 'black';

  let title = 'Nothing on screen yet';
  if (display?.mode === 'screen') title = display.screen?.title ?? 'Please Wait';
  else if (display?.mode === 'black') title = 'Black screen';
  else if (display?.mode === 'logo') title = 'Event logo';
  else if (media) title = display?.title ?? media.name;

  return (
    <div className="flex flex-col gap-5 px-5 py-4">
      {/* ── Program ───────────────────────────────────────────── */}
      <section aria-label="On the projector">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', onAir ? 'ec-dot-live bg-[#e5484d] text-[#e5484d]/50' : 'bg-slate-600')} aria-hidden />
          <h3 className="ec-label">{live ? (display?.mode === 'black' ? 'Projector · black' : 'On the projector') : 'Projector offline'}</h3>
          <Button size="sm" variant="ghost" icon={<Maximize size={13} />} onClick={props.onFullscreen} className="-my-1 ml-auto text-[12px]" title="Ask the projector window to go fullscreen (F)">
            Fullscreen
          </Button>
        </div>
        {props.showPreview && (
          <div className={cn('ec-monitor relative mx-auto aspect-video w-full', onAir && 'ec-onair')} style={{ maxWidth: 'calc(var(--preview-h, 40vh) * 16 / 9)' }}>
            <div className="absolute inset-0 overflow-hidden rounded-[6px]">
              {display ? (
                <DisplayStage display={display} timer={props.timer} variant="preview" videoCommand={props.videoCommand} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#fff]/50">Connecting…</div>
              )}
              {display?.mode === 'black' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="border border-[#fff]/15 px-3 py-1 font-mono text-xs tracking-[0.3em] text-[#fff]/45">BLACK</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          {media ? <MediaIcon kind={media.kind} size={15} /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-white">{title}</p>
            {currentItem?.notes && (
              <button onClick={() => props.onEditNotes(currentItem)} className="mt-0.5 flex max-w-full items-center gap-1.5 text-left text-[13px] text-amber-300 hover:underline">
                <StickyNote size={13} className="shrink-0" />
                <span className="truncate">{currentItem.notes}</span>
              </button>
            )}
          </div>
          {paged && (
            <label className="flex shrink-0 items-center gap-2 text-sm text-slate-400">
              {Word}
              <select
                value={page}
                onChange={(e) => props.onGoToPage(Number(e.target.value))}
                className="h-9 rounded-[5px] border border-[var(--line-strong)] bg-console-900 pr-7 pl-2.5 text-sm font-medium text-white tabular-nums focus:border-sky-400 focus:outline-none"
                aria-label={`Go to ${word}`}
              >
                {Array.from({ length: count }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <span className="tabular-nums">of {count}</span>
            </label>
          )}
        </div>
        {(media?.kind === 'video' || media?.kind === 'presentation') && (
          <div className="mt-2 flex flex-wrap gap-1.5">
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

      {/* ── Transport ─────────────────────────────────────────── */}
      <section aria-label="Move through the show" className="flex flex-col gap-2">
        {props.startLabel ? (
          <Button variant="primary" className="h-14 w-full text-[16px]" icon={<Play size={18} fill="currentColor" />} onClick={props.onStart}>
            {props.startLabel}
          </Button>
        ) : offFlow && currentItem ? (
          <Button variant="primary" className="h-12 w-full justify-start px-4 text-[15px]" icon={<Undo2 size={17} />} onClick={props.onResume}>
            <span className="min-w-0 flex-1 truncate text-left">Back to {itemLabel(currentItem)}</span>
            <Kbd className="ec-kbd-on-solid">Esc</Kbd>
          </Button>
        ) : null}
        <div className="grid grid-cols-[1fr_1.6fr] gap-2">
          <Button variant="secondary" className="h-14 text-[15px]" onClick={props.onPrevious} disabled={!props.canPrevious} icon={<ChevronLeft size={20} className="ec-nudge-left" />}>
            Previous
          </Button>
          <NextButton disabled={!props.canNext} onClick={props.onNext} nextPage={nextPage} word={Word} pdfUrl={media?.pdfUrl ?? null} nextItem={nextItem} />
        </div>
        <UpNext nextPage={nextPage} pdfUrl={media?.pdfUrl ?? null} word={Word} item={nextItem} />
      </section>

      {props.children}
    </div>
  );
});

/** "Next" says what it will do: the next slide, or the next item in the Flow. */
function NextButton({ disabled, onClick, nextPage, word, pdfUrl, nextItem }: { disabled: boolean; onClick: () => void; nextPage: number | null; word: string; pdfUrl: string | null; nextItem: QueueItem | null }) {
  const [peek, setPeek] = useState(false);
  const detail = nextPage ? `${word} ${nextPage}` : nextItem ? itemLabel(nextItem) : 'End of the Flow';
  return (
    <div className="relative" onMouseEnter={() => setPeek(true)} onMouseLeave={() => setPeek(false)}>
      <Button variant="primary" className="h-14 w-full flex-col !gap-0 px-4 leading-tight" onClick={onClick} disabled={disabled}>
        <span className="flex items-center gap-1.5 text-[16px]">
          Next <ChevronRight size={20} className="ec-nudge-right" />
        </span>
        <span className="max-w-full truncate text-[12px] font-medium opacity-80">{detail}</span>
      </Button>
      {peek && !disabled && (nextPage || nextItem) && (
        <div className="ec-card ec-card-raised ec-peek pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-64 rounded-md p-2">
          <div className="aspect-video overflow-hidden rounded-[3px] bg-black">
            {nextPage && pdfUrl ? <PdfThumb url={pdfUrl} page={nextPage} width={256} className="h-full w-full" /> : nextItem ? <ItemPicture item={nextItem} /> : null}
          </div>
          <p className="mt-1.5 truncate text-xs text-slate-400">
            Next: <span className="font-medium text-slate-200">{detail}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** A quiet line under the buttons: what the audience will see next. */
function UpNext({ nextPage, pdfUrl, word, item }: { nextPage: number | null; pdfUrl: string | null; word: string; item: QueueItem | null }) {
  if (!nextPage && !item) return <p className="text-[13px] text-slate-500">This is the last item in the Flow.</p>;
  return (
    <div className="flex items-center gap-3 text-[13px] text-slate-400">
      <span className="h-[34px] w-[60px] shrink-0 overflow-hidden rounded-[3px] border border-[var(--line)] bg-black">
        {nextPage && pdfUrl ? <PdfThumb url={pdfUrl} page={nextPage} width={60} className="h-full w-full" /> : item ? <ItemPicture item={item} small /> : null}
      </span>
      <span className="min-w-0 truncate">
        <span className="font-semibold text-slate-300">Up next</span> · {nextPage ? `${word} ${nextPage}` : `${itemLabel(item!)} — ${itemDetail(item!)}`}
      </span>
    </div>
  );
}

function ItemPicture({ item, small }: { item: QueueItem; small?: boolean }) {
  if (item.kind === 'screen')
    return (
      <div className={cn('flex h-full items-center justify-center bg-[#0f1a2e] px-2 text-center font-semibold text-[#fff]', small ? 'text-[6px] uppercase' : 'text-sm')}>
        {item.screen?.title ?? item.title ?? 'Screen'}
      </div>
    );
  const m = item.media;
  if (m?.pdfUrl && !m.missing) return <PdfThumb url={m.pdfUrl} page={item.startPage ?? 1} width={small ? 60 : 256} className="h-full w-full" />;
  if (m?.kind === 'image' && !m.missing) return <img src={m.url} alt="" className="h-full w-full object-contain" />;
  return <div className="flex h-full items-center justify-center">{m && <MediaIcon kind={m.kind} size={small ? 7 : 14} />}</div>;
}
