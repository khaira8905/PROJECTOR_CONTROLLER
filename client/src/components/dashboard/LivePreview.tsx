import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Maximize, Monitor, Pause, Play, RotateCcw, SkipBack, SkipForward, StickyNote } from 'lucide-react';
import { DisplayStage, type VideoCommand } from '../display/DisplayStage';
import { PdfThumb } from '../PdfThumb';
import { MediaIcon } from '../MediaIcon';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { cn } from '../../lib/cn';
import { itemDetail, itemLabel, pageWord } from '../../lib/flow';
import { revealWithin } from '../../lib/scroll';
import type { DisplaySnapshot, QueueItem, TimerSnapshot } from '../../types';

interface LivePreviewProps {
  display: DisplaySnapshot | null;
  timer: TimerSnapshot | null;
  timerRemaining: number;
  videoCommand: VideoCommand | null;
  /** A projector window is connected. */
  live: boolean;
  currentItem: QueueItem | null;
  nextItem: QueueItem | null;
  canNext: boolean;
  canPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onShowItem: (item: QueueItem) => void;
  onGoToPage: (page: number) => void;
  onVideo: (action: VideoCommand['action']) => void;
  onOpenExternally: (mediaId: string) => void;
  onFullscreen: () => void;
  onEditNotes: (item: QueueItem) => void;
  previousItem: QueueItem | null;
}

const modeLabel = { media: 'On air', screen: 'Screen', black: 'Black', logo: 'Logo' } as const;

/** What the audience sees right now, and the controls to move through it. */
export function LivePreview(props: LivePreviewProps) {
  const { display, timer, timerRemaining, videoCommand, live, currentItem, nextItem, previousItem } = props;
  const media = display?.mode === 'media' ? display.media : null;
  const paged = !!media?.pdfUrl && !!media.pageCount;
  const word = pageWord(media);
  const page = display?.page ?? 1;
  const range = display?.range ?? null;
  const count = media?.pageCount ?? 0;

  let heading = 'Nothing on screen';
  if (display?.mode === 'screen') heading = display.screen?.title ?? 'Please Wait';
  else if (display?.mode === 'black') heading = 'Black screen';
  else if (display?.mode === 'logo') heading = 'Event logo';
  else if (media) heading = display?.title ?? media.name;

  // What pressing Next will put on the projector.
  const lastPage = range ? range.end : count;
  const nextPage = paged && !display?.adHocMediaId && page < lastPage ? page + 1 : null;
  const onAir = !!live && !!display && display.mode !== 'black';

  return (
    <section className="ec-card flex min-h-0 flex-col rounded-xl">
      <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <Monitor size={20} className="shrink-0 text-slate-300" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.01em] text-white">
          Live Preview <span className="font-normal text-slate-500">– {heading}</span>
        </h2>
        {display && (
          <Badge tone={!live ? 'neutral' : display.mode === 'media' ? 'live' : display.mode === 'black' ? 'neutral' : 'info'} dot={display.mode === 'media' && live}>
            {live ? modeLabel[display.mode] : 'Projector offline'}
          </Badge>
        )}
        <span className="hidden text-sm text-slate-400 tabular-nums xl:inline">16 : 9</span>
        <Button size="sm" variant="secondary" icon={<Maximize size={14} />} onClick={props.onFullscreen} title="Ask the projector window to go fullscreen (F)">
          Fullscreen
        </Button>
      </header>

      {/* The picture: always 16:9, letterboxed in black, sized so the whole console fits on one screen. */}
      <div className="mx-4 flex items-center justify-center overflow-hidden rounded-md bg-black" style={{ height: 'var(--preview-h)' } as CSSProperties}>
        <div className={cn('relative aspect-video max-h-full w-full', onAir && 'ec-onair')} style={{ maxWidth: 'calc(var(--preview-h) * 16 / 9)' }}>
          {display ? (
            <DisplayStage display={display} timer={timer} timerRemaining={timerRemaining} variant="preview" videoCommand={videoCommand} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#fff]/50">Connecting…</div>
          )}
          {display?.mode === 'black' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded border border-[#fff]/15 px-3 py-1 font-mono text-xs tracking-[0.3em] text-[#fff]/45">BLACK</span>
            </div>
          )}
        </div>
      </div>

      {/* File, slide count and transport. */}
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          {media ? (
            <MediaIcon kind={media.kind} size={17} />
          ) : (
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-console-700 text-slate-400">
              <Monitor size={17} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-white">{media ? media.name : heading}</p>
            <p className="truncate text-[13px] text-slate-500">
              {paged
                ? `${word[0].toUpperCase() + word.slice(1)} ${page} of ${count}`
                : display?.mode === 'screen'
                  ? 'Special screen'
                  : display?.mode === 'black'
                    ? 'The projector is showing black'
                    : display?.mode === 'logo'
                      ? 'Full-screen logo'
                      : media
                        ? media.kind === 'video'
                          ? 'Video'
                          : 'Image'
                        : 'Nothing programmed'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="h-11 w-12 px-0"
            onClick={() => previousItem && props.onShowItem(previousItem)}
            disabled={!previousItem}
            aria-label="Previous item"
            title={previousItem ? `Back to ${itemLabel(previousItem)}` : 'Previous item'}
          >
            <SkipBack size={17} />
          </Button>
          <NextSlideButton disabled={!props.canNext} onClick={props.onNext} nextPage={nextPage} pdfUrl={media?.pdfUrl ?? null} word={word} nextItem={nextItem} />
          <Button
            variant="secondary"
            className="h-11 w-12 px-0"
            onClick={() => nextItem && props.onShowItem(nextItem)}
            disabled={!nextItem}
            aria-label="Next item"
            title={nextItem ? `Skip to ${itemLabel(nextItem)}` : 'Next item'}
          >
            <SkipForward size={17} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {paged && (
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <span className="sr-only">Go to {word}</span>
              <select
                value={page}
                onChange={(e) => props.onGoToPage(Number(e.target.value))}
                className="h-10 rounded-md border border-[var(--line-strong)] bg-console-900 pr-7 pl-3 text-sm text-white tabular-nums focus:border-sky-400 focus:outline-none"
              >
                {Array.from({ length: count }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <span className="tabular-nums">/ {count}</span>
            </label>
          )}
          {media?.kind === 'video' && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="secondary" onClick={() => props.onVideo('play')} aria-label="Play video">
                <Play size={16} />
              </Button>
              <Button size="icon" variant="secondary" onClick={() => props.onVideo('pause')} aria-label="Pause video">
                <Pause size={16} />
              </Button>
              <Button size="icon" variant="secondary" onClick={() => props.onVideo('restart')} aria-label="Restart video">
                <RotateCcw size={16} />
              </Button>
            </div>
          )}
          {media?.kind === 'presentation' && (
            <Button variant="secondary" className="h-10" icon={<ExternalLink size={15} />} onClick={() => props.onOpenExternally(media.id)} title="Open the original file in PowerPoint">
              <span className="max-2xl:hidden">Open in PowerPoint</span>
              <span className="2xl:hidden">PowerPoint</span>
            </Button>
          )}
        </div>
      </div>

      {paged ? (
        <SlideStrip key={media!.pdfUrl!} url={media!.pdfUrl!} count={count} current={page} next={nextPage} range={range} onGo={props.onGoToPage} />
      ) : (
        <ComingUp item={nextItem} />
      )}

      {currentItem?.notes && (
        <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[13px]">
          <StickyNote size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="line-clamp-2 flex-1 whitespace-pre-wrap text-slate-200">{currentItem.notes}</p>
          <button className="shrink-0 text-xs font-medium text-slate-400 hover:text-white" onClick={() => props.onEditNotes(currentItem)}>
            Edit
          </button>
        </div>
      )}
    </section>
  );
}

/** "Next Slide", with a peek at exactly what it will show while you hover or focus it. */
function NextSlideButton({
  disabled,
  onClick,
  nextPage,
  pdfUrl,
  word,
  nextItem,
}: {
  disabled: boolean;
  onClick: () => void;
  nextPage: number | null;
  pdfUrl: string | null;
  word: string;
  nextItem: QueueItem | null;
}) {
  const [peek, setPeek] = useState(false);
  const label = nextPage ? `${word[0].toUpperCase() + word.slice(1)} ${nextPage}` : nextItem ? itemLabel(nextItem) : null;
  return (
    <div className="relative" onMouseEnter={() => setPeek(true)} onMouseLeave={() => setPeek(false)} onFocus={() => setPeek(true)} onBlur={() => setPeek(false)}>
      <Button variant="primary" className="h-11 min-w-44 gap-2.5 px-6 text-[15px]" icon={<Play size={16} fill="currentColor" />} onClick={onClick} disabled={disabled}>
        Next Slide <Kbd className="ec-kbd-on-solid ml-1">→</Kbd>
      </Button>
      {peek && !disabled && label && (
        <div className="ec-card ec-card-raised ec-peek pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 rounded-lg p-2">
          <div className="aspect-video overflow-hidden rounded bg-black">
            {nextPage && pdfUrl ? (
              <PdfThumb url={pdfUrl} page={nextPage} width={240} className="h-full w-full" />
            ) : nextItem ? (
              <ItemPicture item={nextItem} />
            ) : null}
          </div>
          <p className="mt-1.5 truncate text-xs text-slate-400">
            Next: <span className="font-medium text-slate-200">{label}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function ItemPicture({ item }: { item: QueueItem }) {
  if (item.kind === 'screen')
    return (
      <div className="flex h-full items-center justify-center bg-[#101a2e] px-3 text-center text-sm font-semibold text-[#fff]">
        {item.screen?.title ?? item.title ?? 'Screen'}
      </div>
    );
  const m = item.media;
  if (m?.pdfUrl && !m.missing) return <PdfThumb url={m.pdfUrl} page={item.startPage ?? 1} width={240} className="h-full w-full" />;
  if (m?.kind === 'image' && !m.missing) return <img src={m.url} alt="" className="h-full w-full object-contain" />;
  return (
    <div className="flex h-full items-center justify-center">
      <MediaIcon kind={m?.kind ?? 'video'} size={14} />
    </div>
  );
}

/** For images, videos and screens: what the next item will be. */
function ComingUp({ item }: { item: QueueItem | null }) {
  return (
    <div className="m-4 mt-3 flex items-center gap-3 rounded-lg border border-dashed border-[var(--line-strong)] px-3 py-2.5">
      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Up next</span>
      {item ? (
        <>
          <div className="h-10 w-[72px] shrink-0 overflow-hidden rounded border border-[var(--line)] bg-black">
            <ItemPicture item={item} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{itemLabel(item)}</p>
            <p className="truncate text-xs text-slate-500">{itemDetail(item)}</p>
          </div>
        </>
      ) : (
        <span className="text-sm text-slate-500">End of the show flow</span>
      )}
    </div>
  );
}

/** Every slide/page as a readable thumbnail; click one to show it. The Show Flow range is highlighted. */
function SlideStrip({
  url,
  count,
  current,
  next,
  range,
  onGo,
}: {
  url: string;
  count: number;
  current: number;
  next: number | null;
  range: { start: number; end: number } | null;
  onGo: (p: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    revealWithin(strip.current?.querySelector<HTMLElement>(`[data-page="${current}"]`), 'x', true);
  }, [current]);
  const scrollBy = (dir: number) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <div className="relative flex items-center gap-1 px-1 py-3">
      <button className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-console-700 hover:text-white" onClick={() => scrollBy(-1)} aria-label="Scroll slides left">
        <ChevronLeft size={20} />
      </button>
      <div ref={strip} className="scroll-thin flex min-w-0 flex-1 gap-3 overflow-x-auto px-1 pt-1 pb-1.5">
        {Array.from({ length: count }, (_, i) => i + 1).map((p) => {
          const inRange = !range || (p >= range.start && p <= range.end);
          const active = p === current;
          return (
            <button key={p} data-page={p} onClick={() => onGo(p)} title={`Show ${p}`} className={cn('group w-36 shrink-0 text-center 2xl:w-40', !inRange && 'opacity-45')}>
              <span
                className={cn(
                  'relative block overflow-hidden rounded-md border bg-[#fff] transition-[border-color,box-shadow,translate] duration-150 group-hover:-translate-y-0.5',
                  active ? 'border-sky-500 shadow-[0_0_0_2px_var(--accent-500)]' : 'border-[var(--line-strong)] group-hover:border-sky-400',
                )}
              >
                <PdfThumb url={url} page={p} width={176} className="aspect-video w-full" />
                {p === next && <span className="absolute top-1 right-1 rounded bg-sky-500 px-1.5 py-px text-[10px] font-semibold text-[#fff]">Next</span>}
              </span>
              <span className={cn('mt-1 block text-xs tabular-nums', active ? 'font-semibold text-sky-300' : 'text-slate-500')}>{p}</span>
            </button>
          );
        })}
      </div>
      <button className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-console-700 hover:text-white" onClick={() => scrollBy(1)} aria-label="Scroll slides right">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
