import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListVideo, Pencil, Play, StickyNote, X } from 'lucide-react';
import { MediaIcon } from '../MediaIcon';
import { Panel } from '../ui/Panel';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';
import { formatDurationShort } from '../../lib/format';
import type { QueueItem } from '../../types';
import { itemLabel } from './UpNextCard';

interface QueuePanelProps {
  queue: QueueItem[];
  currentId: string | null;
  nextId: string | null;
  onAir: boolean;
  onReorder: (queue: QueueItem[]) => void;
  onShow: (item: QueueItem) => void;
  onEdit: (item: QueueItem) => void;
  onRemove: (item: QueueItem) => void;
  className?: string;
}

export function QueuePanel({ queue, currentId, nextId, onAir, onReorder, onShow, onEdit, onRemove, className }: QueuePanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = queue.findIndex((q) => q.id === active.id);
    const to = queue.findIndex((q) => q.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(queue, from, to));
  };

  const totalSeconds = queue.reduce((sum, q) => sum + (q.durationSeconds ?? 0), 0);

  return (
    <Panel
      title="Event queue"
      icon={<ListVideo size={14} />}
      actions={<span className="text-xs text-slate-500">{queue.length} items{totalSeconds ? ` · ${formatDurationShort(totalSeconds)}` : ''}</span>}
      className={className}
      bodyClassName="scroll-thin overflow-y-auto p-2"
    >
      {queue.length === 0 ? (
        <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center text-sm text-slate-500">
          <ListVideo size={28} className="mb-2 text-slate-600" />
          The queue is empty.
          <br />
          Add files from the media library with <b className="text-slate-300">+ Queue</b>.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={queue.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1">
              {queue.map((item, index) => (
                <SortableRow
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

function SortableRow({
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

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors',
        isCurrent ? (onAir ? 'border-red-500/40 bg-red-500/[0.08]' : 'border-sky-500/40 bg-sky-500/[0.07]') : 'border-transparent hover:bg-white/[0.03]',
        isDragging && 'z-10 border-sky-400/50 bg-console-700 shadow-xl',
      )}
      onDoubleClick={onShow}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-slate-600 hover:text-slate-300 active:cursor-grabbing"
        aria-label={`Reorder ${itemLabel(item)}`}
      >
        <GripVertical size={16} />
      </button>
      <span className="w-5 text-right font-mono text-xs text-slate-500">{index + 1}</span>
      <MediaIcon kind={item.media.kind} size={13} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-sm font-medium', isCurrent ? 'text-white' : 'text-slate-200')}>{itemLabel(item)}</p>
          {item.notes && <StickyNote size={12} className="shrink-0 text-amber-400/70" aria-label="Has notes" />}
        </div>
        <p className="truncate text-xs text-slate-500">
          {item.media.missing ? <span className="text-red-400">File missing · </span> : null}
          {item.title ? item.media.name : null}
          {item.durationSeconds ? `${item.title ? ' · ' : ''}${formatDurationShort(item.durationSeconds)}` : null}
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
        <Button size="icon-sm" variant="ghost" onClick={onShow} aria-label={`Show ${itemLabel(item)} on display`} title="Show on display">
          <Play size={14} />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edit item" title="Edit title, duration & notes">
          <Pencil size={14} />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label="Remove from queue" title="Remove from queue" className="hover:text-red-300">
          <X size={14} />
        </Button>
      </div>
    </li>
  );
}
