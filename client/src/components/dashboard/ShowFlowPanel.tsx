import { useEffect, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, FolderOpen, GripVertical, ListVideo, MonitorSmartphone, Pencil, Play, Plus, StickyNote, X } from 'lucide-react';
import { PdfThumb } from '../PdfThumb';
import { MediaIcon } from '../MediaIcon';
import { Panel } from '../ui/Panel';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import { formatDurationShort } from '../../lib/format';
import { itemDetail, itemLabel } from '../../lib/flow';
import { revealWithin } from '../../lib/scroll';
import type { QueueItem, Screen } from '../../types';

interface ShowFlowPanelProps {
  flow: QueueItem[];
  screens: Screen[];
  currentId: string | null;
  nextId: string | null;
  onAir: boolean;
  onReorder: (flow: QueueItem[]) => void;
  onShow: (item: QueueItem) => void;
  onEdit: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => void;
  onAddScreen: (screen: Screen) => void;
  /** Opens the file library to add a presentation or other file. */
  onAddFile?: () => void;
  className?: string;
}

/** Run of Show: the whole event prepared in advance, operated manually. */
export function ShowFlowPanel({ flow, screens, currentId, nextId, onAir, onReorder, onShow, onEdit, onRemove, onAddScreen, onAddFile, className }: ShowFlowPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  // Keep the live item in view as the show advances.
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
    <Panel
      title="Show Flow"
      icon={<ListVideo size={20} />}
      className={className}
      bodyClassName="scroll-thin overflow-y-auto px-2 py-1.5"
      actions={
        <>
          <div className="relative">
            <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
              Add
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="ec-card ec-card-raised ec-pop-in absolute right-0 z-20 mt-1 max-h-72 w-60 origin-top-right overflow-y-auto rounded-xl py-1">
                  {onAddFile && (
                    <>
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                        onClick={() => {
                          setMenuOpen(false);
                          onAddFile();
                        }}
                      >
                        <FolderOpen size={15} className="text-slate-400" /> Presentation or file…
                      </button>
                      <div className="my-1 border-t ec-divider" />
                    </>
                  )}
                  <p className="px-3 py-1.5 text-[11px] font-medium text-slate-500">Screens</p>
                  {screens.map((s) => (
                    <button
                      key={s.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                      onClick={() => {
                        setMenuOpen(false);
                        onAddScreen(s);
                      }}
                    >
                      <ScreenDot style={s.style} /> {s.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button size="sm" variant="secondary" icon={editing ? <Check size={14} /> : <Pencil size={14} />} onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
            {editing ? 'Done' : 'Edit'}
          </Button>
        </>
      }
    >
      {flow.length === 0 ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center text-sm text-slate-500">
          <ListVideo size={30} className="ec-bob mb-3 text-sky-400/60" />
          <p>Build the running order of your event.</p>
          <p>
            Press <b className="text-slate-300">Add</b> to put presentations and screens in order.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={flow.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <ol ref={listRef} className="flex flex-col">
              {flow.map((item, index) => (
                <FlowRow
                  key={item.id}
                  item={item}
                  index={index}
                  isCurrent={item.id === currentId}
                  isNext={item.id === nextId}
                  onAir={onAir}
                  editing={editing}
                  onShow={() => onShow(item)}
                  onEdit={() => onEdit(item)}
                  onRemove={() => onRemove(item)}
                />
              ))}
            </ol>
            <p className="px-2 pt-2 pb-1 text-xs text-slate-500">
              {flow.length} {flow.length === 1 ? 'item' : 'items'}
              {totalSeconds ? ` · about ${formatDurationShort(totalSeconds)}` : ''}
            </p>
          </SortableContext>
        </DndContext>
      )}
    </Panel>
  );
}

const dotColor: Record<string, string> = {
  'please-wait': 'bg-sky-400',
  technical: 'bg-orange-400',
  break: 'bg-teal-400',
  starting: 'bg-cyan-400',
  'coming-up': 'bg-indigo-400',
  thanks: 'bg-fuchsia-400',
  custom: 'bg-slate-400',
};

export function ScreenDot({ style }: { style: string }) {
  return <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotColor[style] ?? dotColor.custom)} />;
}

function FlowRow({
  item,
  index,
  isCurrent,
  isNext,
  onAir,
  editing,
  onShow,
  onEdit,
  onRemove,
}: {
  item: QueueItem;
  index: number;
  isCurrent: boolean;
  isNext: boolean;
  onAir: boolean;
  editing: boolean;
  onShow: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const label = itemLabel(item);

  return (
    <li
      ref={setNodeRef}
      data-flow-id={item.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150',
        isCurrent ? 'ec-row-active' : 'hover:bg-[var(--row-hover)]',
        isDragging && 'z-10 bg-console-800 shadow-lg ring-1 ring-sky-400/40',
      )}
      onDoubleClick={onShow}
      title="Double-click to show on the display"
    >
      <span
        className={cn(
          'flex h-7 w-8 shrink-0 items-center justify-center rounded-md border font-mono text-xs tabular-nums',
          isCurrent ? (onAir ? 'border-red-500 bg-red-500 text-[#fff]' : 'border-sky-500 bg-sky-500 text-[#fff]') : 'border-[var(--line-strong)] text-slate-400',
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <FlowThumb item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-[13px] font-medium', isCurrent ? 'text-sky-300' : 'text-slate-200')}>{label}</p>
          {item.notes && <StickyNote size={12} className="shrink-0 text-amber-400" aria-label="Has notes" />}
        </div>
        <p className="truncate text-xs text-slate-500">
          {item.media?.missing ? <span className="text-red-400">File missing · </span> : null}
          {itemDetail(item)}
        </p>
      </div>
      {editing ? (
        <div className="flex items-center">
          <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${label}`} title="Edit title, slides, duration & notes">
            <Pencil size={14} />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${label} from flow`} title="Remove from flow" className="hover:text-red-300">
            <X size={15} />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center group-focus-within:hidden group-hover:hidden">
            {isCurrent && onAir && (
              <Badge tone="live" dot>
                Live
              </Badge>
            )}
            {isNext && !isCurrent && <span className="text-[11px] font-medium text-slate-500">Next</span>}
          </div>
          <div className="hidden items-center group-focus-within:flex group-hover:flex">
            <Button size="icon-sm" variant="ghost" onClick={onShow} aria-label={`Show ${label} on display`} title="Show on display">
              <Play size={14} />
            </Button>
          </div>
        </>
      )}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-slate-600 hover:text-slate-300 active:cursor-grabbing"
        aria-label={`Reorder ${label}`}
      >
        <GripVertical size={16} />
      </button>
    </li>
  );
}

/** A small picture of the item: its first slide, the image itself, or a screen swatch. */
function FlowThumb({ item }: { item: QueueItem }) {
  const box = 'relative h-9 w-16 shrink-0 overflow-hidden rounded-[5px] border border-[var(--line)]';
  if (item.kind === 'screen') {
    return (
      <span className={cn(box, 'flex items-center justify-center bg-[#101a2e]')}>
        <span className="truncate px-1 text-[7px] font-bold tracking-wide text-[#fff]/80 uppercase">{item.screen?.title ?? 'Screen'}</span>
        <span className="absolute bottom-1 left-1">
          <ScreenDot style={item.screen?.style ?? 'custom'} />
        </span>
      </span>
    );
  }
  const media = item.media;
  if (media?.pdfUrl && !media.missing) return <PdfThumb url={media.pdfUrl} page={item.startPage ?? 1} width={96} className={cn(box, 'bg-[#fff]')} />;
  if (media?.kind === 'image' && !media.missing) return <img src={media.url} alt="" loading="lazy" className={cn(box, 'object-cover')} />;
  return <span className={cn(box, 'flex items-center justify-center bg-console-850')}>{media ? <MediaIcon kind={media.kind} size={10} className="ring-0" /> : <MonitorSmartphone size={14} />}</span>;
}
