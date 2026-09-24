import { ArrowRight, StickyNote } from 'lucide-react';
import { MediaIcon } from '../MediaIcon';
import type { QueueItem } from '../../types';
import { formatDurationShort } from '../../lib/format';

export function itemLabel(item: QueueItem) {
  return item.title || item.media.name;
}

/** Current + next queue item and the operator-only notes for the current item. */
export function UpNextCard({ current, next, onEditNotes }: { current: QueueItem | null; next: QueueItem | null; onEditNotes: (item: QueueItem) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-white/[0.06] bg-console-850 p-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-sky-400 uppercase">Up next</p>
        {next ? (
          <div className="mt-2 flex items-center gap-3">
            <MediaIcon kind={next.media.kind} size={15} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{itemLabel(next)}</p>
              <p className="truncate text-xs text-slate-500">
                {next.media.name}
                {next.durationSeconds ? ` · ${formatDurationShort(next.durationSeconds)}` : ''}
              </p>
            </div>
            <ArrowRight size={16} className="ml-auto shrink-0 text-slate-600" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{current ? 'End of queue' : 'Queue is empty'}</p>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-amber-300 uppercase">
            <StickyNote size={12} /> Speaker notes
          </p>
          {current && (
            <button className="text-xs text-slate-400 hover:text-white" onClick={() => onEditNotes(current)}>
              Edit
            </button>
          )}
        </div>
        <p className="mt-2 text-sm whitespace-pre-wrap text-amber-50/90">
          {current?.notes ? current.notes : <span className="text-slate-500">{current ? 'No notes for this item.' : 'Select a queue item.'}</span>}
        </p>
        <p className="mt-2 text-[10px] text-slate-600">Visible to operators only — never shown on the display.</p>
      </div>
    </div>
  );
}
