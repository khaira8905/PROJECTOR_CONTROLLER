import { useEffect, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListVideo, MonitorSmartphone, Pencil, Play, Plus, StickyNote, X } from 'lucide-react';
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
  className?: string;
}

/** Run of Show: the whole event prepared in advance, operated manually. */
export function ShowFlowPanel({ flow, screens, currentId, nextId, onAir, onReorder, onShow, onEdit, onRemove, onAddScreen, className }: ShowFlowPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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
      title="Show flow"
      icon={<ListVideo size={14} />}
      className={className}
      bodyClassName="scroll-thin overflow-y-auto p-2"
      actions={
        <>
          <span className="mr-1 text-xs text-slate-500">
            {flow.length} items{totalSeconds ? ` · ${formatDurationShort(totalSeconds)}` : ''}
          </span>
          <div className="relative">
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setMenuOpen((o) => !o)}>
              Screen
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="ec-card ec-card-raised ec-pop-in absolute right-0 z-20 mt-1 max-h-72 w-60 origin-top-right overflow-y-auto rounded-xl py-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Add a screen to the flow</p>
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
        </>
      }
    >
      {flow.length === 0 ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center text-sm text-slate-500">
          <ListVideo size={30} className="ec-bob mb-3 text-sky-400/60" />
          <p>Build the running order of your event.</p>
          <p>
            Use <b className="text-slate-300">+ Flow</b> on a presentation, or <b className="text-slate-300">+ Screen</b> above.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={flow.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <ol ref={listRef} className="flex flex-col gap-1">
              {flow.map((item, index) => (
                <FlowRow
                  key={item.id}
                  item={item}
                  index={index}
                  isCurrent={item.id === currentId}
                  isNext={item.id === nextId}
                  onAir={onAir}
                  onShow={() => onShow(item)}
                  onEdit={() => onEdit(item)}
                  onRemove={() => onRemove(item)}
                />
              ))}
            </ol>
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
  onShow,
  onEdit,
  onRemove,
}: {
  item: QueueItem;
  index: number;
  isCurrent: boolean;
  isNext: boolean;
  onAir: boolean;
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
        'group relative flex items-center gap-2 overflow-hidden rounded-lg border px-2 py-2 transition-[background-color,border-color,box-shadow] duration-300',
        isCurrent
          ? onAir
            ? 'border-red-500/40 bg-gradient-to-r from-red-500/[0.14] to-red-500/[0.03] shadow-[0_0_24px_-10px_rgba(239,68,68,0.6)]'
            : 'border-sky-500/40 bg-gradient-to-r from-sky-500/[0.14] to-sky-500/[0.03]'
          : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.035]',
        isDragging && 'z-10 border-sky-400/50 bg-console-700 shadow-xl',
      )}
      onDoubleClick={onShow}
    >
      {/* A bar on the left edge marks the item on the display. */}
      {isCurrent && <span className={cn('ec-rise-in absolute inset-y-1.5 left-0 w-[3px] rounded-full', onAir ? 'bg-red-400' : 'bg-sky-400')} aria-hidden />}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-slate-600 hover:text-slate-300 active:cursor-grabbing"
        aria-label={`Reorder ${label}`}
      >
        <GripVertical size={16} />
      </button>
      <span className="w-6 font-mono text-xs text-slate-500 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
      {item.kind === 'screen' ? (
        <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
          <ScreenDot style={item.screen?.style ?? 'custom'} />
        </span>
      ) : item.media ? (
        <MediaIcon kind={item.media.kind} size={13} />
      ) : (
        <MonitorSmartphone size={16} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-sm font-medium', isCurrent ? 'text-white' : 'text-slate-200')}>{label}</p>
          {item.notes && <StickyNote size={12} className="shrink-0 text-amber-400/70" aria-label="Has notes" />}
        </div>
        <p className="truncate text-xs text-slate-500">
          {item.media?.missing ? <span className="text-red-400">File missing · </span> : null}
          {itemDetail(item)}
        </p>
      </div>
      {/* Status badges give way to the row actions on hover/focus to keep titles readable. */}
      <div className="flex items-center group-focus-within:hidden group-hover:hidden">
        {isCurrent && (
          <Badge tone={onAir ? 'live' : 'info'} dot={onAir}>
            {onAir ? 'Live' : 'Current'}
          </Badge>
        )}
        {isNext && !isCurrent && <Badge tone="neutral">Next</Badge>}
      </div>
      <div className="hidden items-center group-focus-within:flex group-hover:flex">
        <Button size="icon-sm" variant="ghost" onClick={onShow} aria-label={`Show ${label} on display`} title="Show on display">
          <Play size={14} />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edit item" title="Edit title, slides, duration & notes">
          <Pencil size={14} />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label="Remove from flow" title="Remove from flow" className="hover:text-red-300">
          <X size={14} />
        </Button>
      </div>
    </li>
  );
}
