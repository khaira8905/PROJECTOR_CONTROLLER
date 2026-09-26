import { memo, useEffect, useRef, useState } from 'react';
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
  onShow: (item: QueueItem) => void;
  onGoToPage: (page: number) => void;
  onReorder: (flow: QueueItem[]) => void;
  onEdit: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => void;
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
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the item on screen in view as the show moves on (only this list scrolls).
  useEffect(() => {
    if (!currentId) return;
    revealWithin(listRef.current?.querySelector<HTMLElement>(`[data-flow-id="${currentId}"]`));
  }, [currentId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = flow.findIndex((q) => q.id === active.id);
    const to = flow.findIndex((q) => q.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(flow, from, to));
  };
  const totalSeconds = flow.reduce((sum, q) => sum + (q.durationSeconds ?? 0), 0);

  return (
    <section className={cn('ec-pane flex min-h-0 flex-col', className)} aria-label="Flow">
      <header className="flex items-end gap-3 border-b ec-line px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] leading-none font-semibold tracking-[-0.02em] text-white">Flow</h2>
          <p className="mt-1.5 text-[13px] text-slate-500">
            {flow.length === 0 ? 'Nothing planned yet' : `${flow.length} ${flow.length === 1 ? 'item' : 'items'}${totalSeconds ? ` · about ${formatDurationShort(totalSeconds)}` : ''} · click an item to show it`}
          </p>
        </div>
        <div className="relative">
          <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu">
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
        <Button variant={editing ? 'primary' : 'secondary'} icon={editing ? <Check size={16} /> : <Pencil size={15} />} onClick={() => setEditing((e) => !e)} aria-pressed={editing} disabled={flow.length === 0}>
          {editing ? 'Done' : 'Edit'}
        </Button>
      </header>

      {flow.length === 0 ? (
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
            <ol ref={listRef} className="ec-flow-list scroll-thin min-h-0 flex-1 overflow-y-auto">
              {flow.map((item, index) => (
                <FlowRow
                  key={item.id}
                  item={item}
                  index={index}
                  state={item.id === currentId ? 'current' : item.id === props.nextId ? 'next' : 'idle'}
                  onAir={props.onAir}
                  editing={editing}
                  page={item.id === currentId ? (props.display?.page ?? null) : null}
                  showSlides={props.showSlides}
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

type RowState = 'current' | 'next' | 'idle';

const FlowRow = memo(function FlowRow({
  item,
  index,
  state,
  onAir,
  editing,
  page,
  showSlides,
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
  onShow: (item: QueueItem) => void;
  onGoToPage: (page: number) => void;
  onEdit: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const label = itemLabel(item);
  const current = state === 'current';
  const media = item.media;
  const paged = !!media?.pdfUrl && !!media.pageCount && !media.missing;
  const live = current && onAir;

  return (
    <li
      ref={setNodeRef}
      data-flow-id={item.id}
      data-state={state}
      data-onair={live}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('ec-flow-row ec-flow-in', isDragging && 'z-10 bg-console-800 shadow-lg')}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onShow(item)}
          className="ec-flow-hit flex min-w-0 flex-1 items-center gap-4 py-2.5 pr-2 pl-5 text-left max-sm:gap-2.5 max-sm:pl-3 focus-visible:outline-offset-[-2px]"
          aria-label={`Show ${label}${current ? ' (on screen)' : ''}`}
        >
          <span className={cn('w-6 shrink-0 text-right font-mono text-[13px] tabular-nums', current ? 'font-semibold text-white' : 'text-slate-500')}>{String(index + 1).padStart(2, '0')}</span>
          <FlowThumb item={item} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={cn('truncate text-[15px] font-medium', current ? 'text-white' : 'text-slate-200')}>{label}</span>
              {item.notes && <StickyNote size={13} className="shrink-0 text-amber-400" aria-label="Has speaker notes" />}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-slate-500">
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
            <Button size="icon" variant="ghost" onClick={() => onRemove(item)} aria-label={`Remove ${label} from the flow`} title="Remove from the flow" className="hover:!text-red-400">
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
          onGo={onGoToPage}
        />
      )}
    </li>
  );
});

function RowStatus({ state, live }: { state: RowState; live: boolean }) {
  if (state === 'current')
    return (
      <span className={cn('shrink-0 rounded-[3px] px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em] uppercase', live ? 'bg-[#e5484d] text-[#fff]' : 'bg-sky-500 text-[#fff]')}>
        {live ? 'On air' : 'Current'}
      </span>
    );
  if (state === 'next') return <span className="shrink-0 text-[12px] font-semibold tracking-[0.06em] text-sky-300 uppercase">Next</span>;
  return null;
}

/** The slides of the item on screen, inline in the Flow: click one to jump to it. */
function SlideRow({ url, start, end, page, word, live, onGo }: { url: string; start: number; end: number; page: number | null; word: string; live: boolean; onGo: (p: number) => void }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (page) revealWithin(strip.current?.querySelector<HTMLElement>(`[data-page="${page}"]`), 'x', true);
  }, [page]);
  const pages = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  return (
    <div className="ec-rise-in pb-3 pl-[4.25rem]">
      <div ref={strip} className="scroll-thin flex gap-2 overflow-x-auto pr-4 pb-1.5">
        {pages.map((p) => {
          const active = p === page;
          const next = page !== null && p === page + 1;
          return (
            <button key={p} data-page={p} onClick={() => onGo(p)} className="group w-[124px] shrink-0 text-left" title={`Show ${word} ${p}`}>
              <span
                className={cn(
                  'relative block overflow-hidden rounded-[4px] border bg-[#fff] transition-[border-color,box-shadow] duration-150',
                  active ? (live ? 'border-[#e5484d] shadow-[0_0_0_2px_#e5484d]' : 'border-sky-500 shadow-[0_0_0_2px_var(--accent-500)]') : 'border-[var(--line-strong)] group-hover:border-sky-400',
                )}
              >
                <PdfThumb url={url} page={p} width={124} className="aspect-video w-full" />
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
  const box = 'ec-flow-thumb relative h-[63px] w-[112px] shrink-0 overflow-hidden rounded-[4px] border border-[var(--line)] max-sm:h-[40px] max-sm:w-[71px]';
  if (item.kind === 'screen') {
    return (
      <span className={cn(box, 'flex flex-col items-start justify-end bg-[#0f1a2e] p-1.5')}>
        <ScreenDot style={item.screen?.style ?? 'custom'} />
        <span className="mt-1 line-clamp-2 text-[9px] leading-tight font-semibold tracking-wide text-[#fff]/85 uppercase">{item.screen?.title ?? 'Screen'}</span>
      </span>
    );
  }
  const m = item.media;
  if (m?.pdfUrl && !m.missing) return <PdfThumb url={m.pdfUrl} page={item.startPage ?? 1} width={112} className={cn(box, 'bg-[#fff]')} />;
  if (m?.kind === 'image' && !m.missing) return <img src={m.url} alt="" loading="lazy" decoding="async" className={cn(box, 'bg-black object-cover')} />;
  return (
    <span className={cn(box, 'flex items-center justify-center bg-console-850')}>
      {m ? <MediaIcon kind={m.kind} size={13} className="ring-0" /> : <MonitorSmartphone size={16} className="text-slate-500" />}
    </span>
  );
}
