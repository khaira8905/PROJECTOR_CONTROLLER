import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Check, FolderOpen, GripVertical, LayoutGrid, ListVideo, MonitorSmartphone, Pencil, Plus, StickyNote, X } from 'lucide-react';
import { PdfThumb } from '../PdfThumb';
import { MediaIcon } from '../MediaIcon';
import { Button } from '../ui/Button';
import { ScreenDot } from './ScreenDot';
import { cn } from '../../lib/cn';
import { formatDurationShort } from '../../lib/format';
import { itemDetail, itemLabel, pageWord } from '../../lib/flow';
import { revealWithin } from '../../lib/scroll';
import type { DisplaySnapshot, QueueItem, Screen } from '../../types';

interface FlowPaneProps {
  flow: QueueItem[];
  screens: Screen[];
  display: DisplaySnapshot | null;
  currentId: string | null;
  nextId: string | null;
  /** The current item is what the audience is seeing (not black, a quick screen or a library file). */
  onAir: boolean;
  showSlides: boolean;
  /** Detailed rows with pictures, or a compact list. */
  layout: 'detailed' | 'compact';
  /** Show on click, or select on click and show on double-click / Enter. */
  activation: 'click' | 'double';
  /** Scroll the item on screen into view as the show moves on. */
  followLive: boolean;
  thumbSize: 'small' | 'medium' | 'large';
  /** The Flow is still being fetched (first load). */
  loading?: boolean;
  /** Changes whenever the "Select presentation" shortcut asks for the focus. */
  focusSignal: number;
  onShow: (item: QueueItem) => void;
  onGoToPage: (page: number) => void;
  onReorder: (flow: QueueItem[]) => void;
  onEdit: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => Promise<unknown> | void;
  onAddScreen: (screen: Screen) => void;
  onAddFiles: () => void;
  className?: string;
}

/**
 * The Flow: the running order of the event and the presenter's main workspace.
 * Click an item to put it on the projector; the item on screen opens up to show its
 * slides. One scroll container, so it scrolls the same with a wheel, a trackpad or the
 * keyboard however many items there are, and it never hands the scroll to the page.
 */
export function FlowPane(props: FlowPaneProps) {
  const { flow, screens, currentId, onReorder, className } = props;
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const dragged = useRef(false);

  // Items that arrive after the first render (added here or by another console) get a
  // short highlight; the initial list simply appears.
  const known = useRef<Set<string> | null>(null);
  const arrived = useRef(new Map<string, number>());
  if (known.current) for (const q of flow) if (!known.current.has(q.id) && !arrived.current.has(q.id)) arrived.current.set(q.id, Date.now());
  // Kept for the length of the animation, so a re-render meanwhile doesn't cut it short.
  const fresh = new Set([...arrived.current].filter(([, t]) => Date.now() - t < 1500).map(([id]) => id));
  // The baseline is the first loaded list, not the empty one shown while loading.
  useEffect(() => {
    if (props.loading) return;
    known.current = new Set(flow.map((q) => q.id));
  }, [flow, props.loading]);

  // Reordered by someone else (or by Edit): rows glide to their new places (FLIP).
  const positions = useRef(new Map<string, number>());
  const order = flow.map((q) => q.id).join(',');
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-flow-id]'));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    const skip = dragged.current || reduce;
    dragged.current = false;
    for (const row of rows) {
      const id = row.dataset.flowId!;
      const before = positions.current.get(id);
      const now = row.offsetTop;
      if (!skip && before !== undefined && before !== now) {
        row.animate([{ transform: `translateY(${before - now}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
      }
      positions.current.set(id, now);
    }
  }, [order]);
  const followLive = props.followLive;

  // Keep the item on screen in view as the show moves on (only this list scrolls).
  useEffect(() => {
    if (!currentId || !followLive) return;
    revealWithin(listRef.current?.querySelector<HTMLElement>(`[data-flow-id="${currentId}"]`));
  }, [currentId, followLive]);

  // "Select presentation": put the keyboard focus on the item on screen (or the first one).
  useEffect(() => {
    if (!props.focusSignal) return;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-flow-id="${currentId}"] .ec-flow-hit`) ?? list?.querySelector<HTMLElement>('.ec-flow-hit');
    row?.focus();
    revealWithin(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusSignal]);

  /** ↑ / ↓ move between items, Home / End jump to the ends; Enter shows the focused item. */
  const onListKey = (e: React.KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('.ec-flow-hit') ?? []);
    const at = rows.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
    rows[to].focus();
    revealWithin(rows[to]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    dragged.current = true; // dnd-kit already animated this move
    const from = flow.findIndex((q) => q.id === active.id);
    const to = flow.findIndex((q) => q.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(flow, from, to));
  };
  // Items before the one on screen are done: they step back so what's ahead stands out.
  const currentIndex = currentId ? flow.findIndex((q) => q.id === currentId) : -1;
  const totalSeconds = flow.reduce((sum, q) => sum + (q.durationSeconds ?? 0), 0);

  return (
    <section className={cn('ec-pane flex min-h-0 flex-col', className)} aria-label="Flow">
      <header className="ec-flow-head flex items-center gap-2 border-b ec-line">
        <div className="min-w-0 flex-1">
          <h2 className="t-section text-[19px]">Flow</h2>
          <p className="t-support mt-0.5 truncate">
            {flow.length === 0
              ? 'Nothing planned yet'
              : `${flow.length} ${flow.length === 1 ? 'item' : 'items'}${totalSeconds ? ` · about ${formatDurationShort(totalSeconds)}` : ''} · ${props.activation === 'double' ? 'double-click an item to show it' : 'click an item to show it'}`}
          </p>
        </div>
        <div className="relative">
          <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu">
            Add
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div role="menu" className="ec-card ec-card-raised ec-pop-in absolute right-0 z-30 mt-1 max-h-80 w-64 origin-top-right overflow-y-auto rounded-md py-1 text-sm">
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left font-medium text-slate-100 hover:bg-[var(--row-hover)]"
                  onClick={() => {
                    setMenuOpen(false);
                    props.onAddFiles();
                  }}
                >
                  <FolderOpen size={16} className="text-slate-400" /> Presentations & files…
                </button>
                <p className="border-t ec-line px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.07em] text-slate-500 uppercase">Screens</p>
                {screens.map((s) => (
                  <button
                    key={s.id}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:bg-[var(--row-hover)]"
                    onClick={() => {
                      setMenuOpen(false);
                      props.onAddScreen(s);
                    }}
                  >
                    <ScreenDot style={s.style} /> {s.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <Button size="sm" variant={editing ? 'primary' : 'ghost'} icon={editing ? <Check size={15} /> : <Pencil size={14} />} onClick={() => setEditing((e) => !e)} aria-pressed={editing} disabled={flow.length === 0}>
          {editing ? 'Done' : 'Edit'}
        </Button>
      </header>

      {flow.length === 0 && props.loading ? (
        <ol className="min-h-0 flex-1 overflow-hidden" aria-label="Loading the Flow" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-4 border-b ec-line py-3 pr-4 pl-5" style={{ opacity: 1 - i * 0.2 }}>
              <span className="ec-skeleton h-3 w-5 rounded-[2px]" />
              <span className="ec-skeleton h-[50px] w-[88px] rounded-[3px]" />
              <span className="flex-1">
                <span className="ec-skeleton block h-3.5 w-2/5 rounded-[2px]" />
                <span className="ec-skeleton mt-2 block h-3 w-1/4 rounded-[2px]" />
              </span>
            </li>
          ))}
        </ol>
      ) : flow.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <ListVideo size={34} className="text-slate-600" />
          <div>
            <p className="text-base font-semibold text-white">Plan the running order</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">Add presentations and screens in the order they happen. During the event, click an item to show it.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" icon={<FolderOpen size={16} />} onClick={props.onAddFiles}>
              Add presentations
            </Button>
            <Button icon={<LayoutGrid size={15} />} onClick={() => setMenuOpen(true)}>
              Add a screen
            </Button>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={flow.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <ol ref={listRef} onKeyDown={onListKey} data-layout={props.layout} className="ec-flow-list scroll-thin relative min-h-0 flex-1 overflow-y-auto">
              {flow.map((item, index) => (
                <FlowRow
                  key={item.id}
                  item={item}
                  index={index}
                  state={item.id === currentId ? 'current' : item.id === props.nextId ? 'next' : index < currentIndex ? 'past' : 'idle'}
                  onAir={props.onAir}
                  editing={editing}
                  page={item.id === currentId ? (props.display?.page ?? null) : null}
                  showSlides={props.showSlides}
                  compact={props.layout === 'compact'}
                  thumbWidth={THUMB_WIDTH[props.thumbSize]}
                  activation={props.activation}
                  selected={props.activation === 'double' && selectedId === item.id}
                  isNew={fresh.has(item.id)}
                  onSelect={setSelectedId}
                  onShow={props.onShow}
                  onGoToPage={props.onGoToPage}
                  onEdit={props.onEdit}
                  onRemove={props.onRemove}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

type RowState = 'current' | 'next' | 'past' | 'idle';

const THUMB_WIDTH = { small: 108, medium: 148, large: 196 } as const;

const FlowRow = memo(function FlowRow({
  item,
  index,
  state,
  onAir,
  editing,
  page,
  showSlides,
  compact,
  thumbWidth,
  activation,
  selected,
  isNew,
  onSelect,
  onShow,
  onGoToPage,
  onEdit,
  onRemove,
}: {
  item: QueueItem;
  index: number;
  state: RowState;
  onAir: boolean;
  editing: boolean;
  page: number | null;
  showSlides: boolean;
  compact: boolean;
  thumbWidth: number;
  activation: 'click' | 'double';
  selected: boolean;
  isNew: boolean;
  onSelect: (id: string) => void;
  onShow: (item: QueueItem) => void;
  onGoToPage: (page: number) => void;
  onEdit: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => Promise<unknown> | void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const label = itemLabel(item);
  const current = state === 'current';
  const media = item.media;
  const paged = !!media?.pdfUrl && !!media.pageCount && !media.missing;
  const live = current && onAir;
  const rowRef = useRef<HTMLLIElement | null>(null);
  const [leaving, setLeaving] = useState(false);

  /** The row folds away first, then it is removed; if removing fails it comes back. */
  const remove = async () => {
    const el = rowRef.current;
    if (el) {
      el.style.height = `${el.offsetHeight}px`;
      void el.getBoundingClientRect(); // commit the start height so the fold can animate from it
    }
    setLeaving(true);
    await new Promise((r) => window.setTimeout(r, 190));
    try {
      await onRemove(item);
    } finally {
      if (rowRef.current) rowRef.current.style.height = '';
      setLeaving(false);
    }
  };

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        rowRef.current = el;
      }}
      data-flow-id={item.id}
      data-state={state}
      data-onair={live}
      data-selected={selected || undefined}
      data-leaving={leaving || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('ec-flow-row', isNew && 'ec-flow-new', isDragging && 'ec-dragging z-10')}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => (activation === 'click' ? onShow(item) : onSelect(item.id))}
          onDoubleClick={activation === 'double' ? () => onShow(item) : undefined}
          onKeyDown={(e) => {
            // Enter always shows (also in double-click mode); Space keeps its global meaning.
            if (e.key === 'Enter') {
              e.preventDefault();
              onShow(item);
            }
          }}
          onFocus={activation === 'double' ? () => onSelect(item.id) : undefined}
          className={cn(
            'ec-flow-hit flex min-w-0 flex-1 items-center text-left focus-visible:outline-offset-[-2px]',
            compact ? 'gap-3 py-2 pr-2 pl-5 max-sm:pl-3' : 'gap-5 py-3 pr-3 pl-5 max-sm:gap-2.5 max-sm:pl-3',
          )}
          aria-label={`Show ${label}${current ? ' (on screen)' : ''}`}
        >
          <span className={cn('ec-flow-num w-7 shrink-0 text-right font-mono text-[14px] tabular-nums', current ? 'font-semibold text-white' : 'text-slate-500')}>{String(index + 1).padStart(2, '0')}</span>
          {compact ? (
            <span className="flex w-6 shrink-0 justify-center">
              {item.kind === 'screen' ? <ScreenDot style={item.screen?.style ?? 'custom'} /> : <MediaIcon kind={media?.kind ?? 'pdf'} size={13} className="ring-0" />}
            </span>
          ) : (
            <FlowThumb item={item} />
          )}
          <span className={cn('min-w-0 flex-1', compact && 'flex items-baseline gap-2.5')}>
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn('ec-flow-title truncate', compact ? 'text-[15px]' : 'text-[17px]', current ? 'font-semibold text-white' : 'font-medium text-slate-200')}>{label}</span>
              {item.notes && <StickyNote size={13} className={cn('shrink-0', current ? 'text-amber-400' : 'text-slate-500')} aria-label="Has speaker notes" />}
            </span>
            <span className={cn('block truncate text-slate-500', compact ? 'shrink-0 text-[13px] max-sm:hidden' : 'mt-1 text-[14px]')}>
              {media?.missing ? <span className="text-red-400">File missing — upload it again · </span> : null}
              {itemDetail(item)}
            </span>
          </span>
          <RowStatus state={state} live={live} />
        </button>
        {editing && (
          <span className="ec-rise-in flex shrink-0 items-center gap-1 pr-1">
            <Button size="icon" variant="ghost" onClick={() => onEdit(item)} aria-label={`Edit ${label}`} title="Title, slides, duration and notes">
              <Pencil size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => void remove()} disabled={leaving} aria-label={`Remove ${label} from the flow`} title="Remove from the flow" className="hover:!text-red-400">
              <X size={18} />
            </Button>
          </span>
        )}
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="mr-2 flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-600 hover:bg-console-700 hover:text-slate-300 active:cursor-grabbing"
          aria-label={`Move ${label}`}
          title="Drag to reorder"
        >
          <GripVertical size={17} />
        </button>
      </div>

      {current && showSlides && paged && (
        <SlideRow
          url={media!.pdfUrl!}
          start={Math.min(item.startPage ?? 1, media!.pageCount!)}
          end={Math.min(item.endPage ?? media!.pageCount!, media!.pageCount!)}
          page={page}
          word={pageWord(media)}
          live={live}
          width={thumbWidth}
          onGo={onGoToPage}
        />
      )}
    </li>
  );
});

/** A word, not a badge: the row's bar and tint already carry the state. */
function RowStatus({ state, live }: { state: RowState; live: boolean }) {
  if (state === 'idle' || state === 'past') return null;
  return (
    <span key={`${state}-${live}`} className="ec-row-status ec-text-swap flex shrink-0 items-center gap-1.5" data-live={live || undefined} data-state={state}>
      {state === 'current' && <span className="ec-row-status-dot h-1.5 w-1.5 rounded-full" aria-hidden />}
      {state === 'current' ? (live ? 'On air' : 'Current') : 'Next'}
    </span>
  );
}

/** The slides of the item on screen, inline in the Flow: click one to jump to it. */
function SlideRow({ url, start, end, page, word, live, width, onGo }: { url: string; start: number; end: number; page: number | null; word: string; live: boolean; width: number; onGo: (p: number) => void }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (page) revealWithin(strip.current?.querySelector<HTMLElement>(`[data-page="${page}"]`), 'x', true);
  }, [page]);
  const pages = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  return (
    <div className="ec-rise-in pb-3 pl-[4.25rem]">
      <div ref={strip} className="ec-slide-strip scroll-thin flex gap-2 overflow-x-auto pr-4 pb-1.5">
        {pages.map((p) => {
          const active = p === page;
          const next = page !== null && p === page + 1;
          return (
            <button key={p} data-page={p} onClick={() => onGo(p)} className="group shrink-0 text-left" style={{ width }} title={`Show ${word} ${p}`}>
              <span
                className={cn(
                  'relative block overflow-hidden rounded-[4px] border bg-[#fff] transition-[border-color,box-shadow] duration-150',
                  active ? (live ? 'border-[#e5484d] shadow-[0_0_0_2px_#e5484d]' : 'border-sky-500 shadow-[0_0_0_2px_var(--accent-500)]') : 'border-[var(--line-strong)] group-hover:border-sky-400',
                )}
              >
                <PdfThumb url={url} page={p} width={width} className="aspect-video w-full" />
              </span>
              <span className={cn('mt-1 flex items-center gap-1.5 text-[12px] tabular-nums', active ? 'font-semibold text-white' : 'text-slate-500')}>
                {p}
                {next && <span className="font-semibold text-sky-300">· next</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** First slide, the image itself, or a drawn screen card. */
function FlowThumb({ item }: { item: QueueItem }) {
  const box = 'ec-flow-thumb relative h-[81px] w-[144px] shrink-0 overflow-hidden rounded-[var(--radius-media)] border border-[var(--line)] max-sm:h-[45px] max-sm:w-[80px]';
  if (item.kind === 'screen') {
    return (
      <span className={cn(box, 'flex flex-col items-start justify-end bg-[#0f1a2e] p-1.5')}>
        <ScreenDot style={item.screen?.style ?? 'custom'} />
        <span className="mt-1 line-clamp-2 text-[9px] leading-tight font-semibold tracking-wide text-[#fff]/85 uppercase">{item.screen?.title ?? 'Screen'}</span>
      </span>
    );
  }
  const m = item.media;
  if (m?.pdfUrl && !m.missing) return <PdfThumb url={m.pdfUrl} page={item.startPage ?? 1} width={144} className={cn(box, 'bg-[#fff]')} />;
  if (m?.kind === 'image' && !m.missing) return <img src={m.url} alt="" loading="lazy" decoding="async" className={cn(box, 'bg-black object-cover')} />;
  return (
    <span className={cn(box, 'flex items-center justify-center bg-console-850')}>
      {m ? <MediaIcon kind={m.kind} size={13} className="ring-0" /> : <MonitorSmartphone size={16} className="text-slate-500" />}
    </span>
  );
}
