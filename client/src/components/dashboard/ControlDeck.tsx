import { memo, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MonitorOff, MonitorUp, Play, StickyNote, Undo2 } from 'lucide-react';
import { PdfThumb } from '../PdfThumb';
import { MediaIcon } from '../MediaIcon';
import { Kbd } from '../ui/Kbd';
import { cn } from '../../lib/cn';
import { itemLabel, pageWord } from '../../lib/flow';
import { comboParts } from '../../lib/shortcuts';
import type { DisplaySnapshot, QueueItem } from '../../types';

interface ControlDeckProps {
  display: DisplaySnapshot | null;
  /** A projector window is connected. */
  live: boolean;
  currentItem: QueueItem | null;
  nextItem: QueueItem | null;
  /** Something other than the current Flow item is on screen (black, a quick screen, a library file). */
  offFlow: boolean;
  canNext: boolean;
  canPrevious: boolean;
  /** Label for the Start button when nothing from the Flow has been shown yet. */
  startLabel: string | null;
  onStart: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onResume: () => void;
  onGoToPage: (page: number) => void;
  onEditNotes: (item: QueueItem) => void;
  black: { enabled: boolean; confirm: boolean; active: boolean };
  onBlack: () => void;
  keys: { next?: string; previous?: string; resume?: string; black?: string };
  /** Where the current item sits in the Flow (for content without slides). */
  position: { index: number; total: number } | null;
}

/**
 * The top of the primary column: what is being presented right now, and the controls
 * that move the show. Everything here answers "what am I presenting, what can I do now".
 */
export const ControlDeck = memo(function ControlDeck(props: ControlDeckProps) {
  const { display, live, currentItem, nextItem } = props;
  const media = display?.mode === 'media' ? display.media : null;
  const paged = !!media?.pdfUrl && !!media.pageCount;
  const word = pageWord(media);
  const Word = word[0].toUpperCase() + word.slice(1);
  const page = display?.page ?? 1;
  const count = media?.pageCount ?? 0;
  const lastPage = display?.range ? display.range.end : count;
  const nextPage = paged && !display?.adHocMediaId && page < lastPage ? page + 1 : null;
  const black = display?.mode === 'black';
  const state = !live ? 'offline' : black ? 'black' : display ? 'live' : 'idle';

  let title = 'Nothing on screen yet';
  if (display?.mode === 'screen') title = display.screen?.title ?? 'Please Wait';
  else if (black) title = currentItem ? itemLabel(currentItem) : 'Black screen';
  else if (display?.mode === 'logo') title = 'Logo screen';
  else if (media) title = display?.title ?? media.name;

  return (
    <section className="ec-deck shrink-0" aria-label="Now presenting and controls" data-state={state}>
      {/* ── Now presenting ─────────────────────────────── */}
      <div className="ec-now flex items-center gap-3">
        <span className="ec-now-tally" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="ec-label ec-now-label mb-0.5">{state === 'offline' ? 'Projector offline' : black ? 'Black screen · audience sees black' : props.offFlow ? 'On the projector · outside the Flow' : 'Now presenting'}</p>
          <div className="flex min-w-0 items-center gap-2">
            <h2 key={title} className="ec-now-title t-value ec-text-swap truncate">
              {title}
            </h2>
          </div>
          {currentItem?.notes && (
            <button onClick={() => props.onEditNotes(currentItem)} className="ec-now-notes mt-0.5 flex max-w-full items-center gap-1.5 text-left text-[13px] text-amber-300 hover:underline" title="Speaker notes (click to edit)">
              <StickyNote size={13} className="shrink-0" />
              <span className="truncate">{currentItem.notes}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Primary controls: one toolbar, the way a console groups its transport ── */}
      <div className="ec-transport mt-3 flex flex-col gap-2">
        {props.startLabel ? (
          <button className="ec-cue-bar" data-tone="start" onClick={props.onStart}>
            <Play size={15} fill="currentColor" className="ec-icon-play shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{props.startLabel}</span>
            <span className="ec-cue-hint">Start</span>
          </button>
        ) : props.offFlow && currentItem ? (
          <button className="ec-cue-bar" data-tone="resume" onClick={props.onResume}>
            <Undo2 size={15} className="ec-icon-back shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Back to {itemLabel(currentItem)}</span>
            {props.keys.resume && <KeyHint combo={props.keys.resume} className="ec-kbd-on-solid" />}
          </button>
        ) : null}
        <div className="flex gap-2">
          <div className="ec-toolbar flex min-w-0 flex-1" role="toolbar" aria-label="Move through the show">
            <button className="ec-tb-btn ec-tb-prev" onClick={props.onPrevious} disabled={!props.canPrevious} aria-label="Previous" title="Previous">
              <ChevronLeft size={19} className="ec-nudge-left" />
              <span className="max-[480px]:hidden">Previous</span>
            </button>
            <Counter paged={paged} page={page} count={count} word={Word} position={props.position} onGoToPage={props.onGoToPage} />
            <NextButton disabled={!props.canNext} onClick={props.onNext} nextPage={nextPage} word={Word} pdfUrl={media?.pdfUrl ?? null} nextItem={nextItem} />
          </div>
          {props.black.enabled && <BlackButton {...props.black} hint={props.keys.black} onPress={props.onBlack} />}
        </div>
      </div>
    </section>
  );
});

/** "Next" says what it will do: the next slide, or the next item in the Flow. */
function NextButton({ disabled, onClick, nextPage, word, pdfUrl, nextItem }: { disabled: boolean; onClick: () => void; nextPage: number | null; word: string; pdfUrl: string | null; nextItem: QueueItem | null }) {
  const [peek, setPeek] = useState(false);
  const detail = nextPage ? `${word} ${nextPage}` : nextItem ? itemLabel(nextItem) : 'End of the Flow';
  return (
    <div className="relative flex min-w-0 flex-[1.6]" onMouseEnter={() => setPeek(true)} onMouseLeave={() => setPeek(false)}>
      <button className="ec-tb-btn ec-tb-primary w-full" onClick={onClick} disabled={disabled} aria-label={`Next: ${detail}`}>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="text-[var(--text-control)] font-semibold">Next</span>
          <span className="ec-next-detail max-w-full truncate text-[12px] font-normal opacity-80">{detail}</span>
        </span>
        <ChevronRight size={20} className="ec-nudge-right ml-auto shrink-0" />
      </button>
      {peek && !disabled && (nextPage || nextItem) && (
        <div className="ec-card ec-card-raised ec-peek pointer-events-none absolute top-full left-1/2 z-40 mt-2 w-64 rounded-md p-2">
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

/**
 * Black Screen with an unmistakable state: outlined while the picture is up, solid black
 * while the audience sees black. Optionally asks for a second click (the shortcut acts at once).
 */
function BlackButton({ active, confirm, hint, onPress }: { active: boolean; confirm: boolean; hint?: string; onPress: () => void }) {
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
      onClick={press}
      aria-pressed={active}
      aria-label={active ? 'Black is on — show the picture again' : armed ? 'Click again to go black' : 'Black screen'}
      title={active ? 'Show the picture again' : armed ? 'Click again to go black' : 'Black screen'}
      data-state={active ? 'on' : armed ? 'armed' : 'off'}
      className="ec-black-btn group flex w-[6.5rem] shrink-0 items-center justify-center gap-2 px-3 text-[var(--text-sm)] font-semibold"
    >
      {active ? <MonitorUp size={17} className="shrink-0" /> : <MonitorOff size={17} className="shrink-0" />}
      <span className="whitespace-nowrap">{active ? 'Black on' : armed ? 'Again?' : 'Black'}</span>
      {hint && !active && !armed && <KeyHint combo={hint} />}
    </button>
  );
}

/** A key hint on a button ("B", "Esc"); hidden when the operator turns hints off. */
export function KeyHint({ combo, className }: { combo: string; className?: string }) {
  return (
    <span className="ec-hint flex shrink-0 gap-0.5">
      {comboParts(combo).map((p) => (
        <Kbd key={p} className={className}>
          {p}
        </Kbd>
      ))}
    </span>
  );
}

/** A small picture of a Flow item: its first slide, the image, or a drawn screen card. */
export function ItemPicture({ item, small }: { item: QueueItem; small?: boolean }) {
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

/**
 * The middle of the transport: where we are, as a number. For slides, click it to jump
 * (a native select sits invisibly on top); otherwise it shows the item's place in the Flow.
 */
function Counter({ paged, page, count, word, position, onGoToPage }: { paged: boolean; page: number; count: number; word: string; position: { index: number; total: number } | null; onGoToPage: (p: number) => void }) {
  const label = paged ? word : position ? 'Item' : '';
  const value = paged ? page : position ? position.index + 1 : null;
  const total = paged ? count : (position?.total ?? null);
  return (
    <div className={cn('ec-tb-counter relative flex w-[6.5rem] shrink-0 flex-col items-center justify-center', paged && 'ec-tb-counter-live')}>
      <span className="text-[10px] font-medium tracking-[0.08em] text-slate-500 uppercase">{label || '—'}</span>
      {value !== null ? (
        <span className="t-num flex items-baseline gap-1 leading-none">
          <span key={value} className="ec-text-swap text-[22px] text-white">
            {value}
          </span>
          <span className="text-[13px] font-medium text-slate-500">/ {total}</span>
        </span>
      ) : (
        <span className="text-[13px] text-slate-500">Not started</span>
      )}
      {paged && (
        <select value={page} onChange={(e) => onGoToPage(Number(e.target.value))} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Go to ${word.toLowerCase()} (${page} of ${count})`} title={`Jump to a ${word.toLowerCase()}`}>
          {Array.from({ length: count }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {word} {i + 1}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
