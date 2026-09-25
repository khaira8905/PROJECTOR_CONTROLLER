import { ArrowRight, StickyNote } from 'lucide-react';
import { MediaIcon } from '../MediaIcon';
import type { QueueItem } from '../../types';
import { itemDetail, itemLabel } from '../../lib/flow';
import { ScreenDot } from './ShowFlowPanel';

/** Current + next queue item and the operator-only notes for the current item. */
export function UpNextCard({ current, next, onEditNotes }: { current: QueueItem | null; next: QueueItem | null; onEditNotes: (item: QueueItem) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="group rounded-xl bg-gradient-to-br from-sky-500/[0.09] to-transparent p-4 ring-1 ring-sky-400/15 ring-inset">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-sky-400 uppercase">Up next</p>
        {next ? (
          <div key={next.id} className="ec-fade-up mt-2 flex items-center gap-3" style={{ animationDuration: '450ms' }}>
            {next.media ? <MediaIcon kind={next.media.kind} size={15} /> : <ScreenDot style={next.screen?.style ?? 'custom'} />}
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{itemLabel(next)}</p>
              <p className="truncate text-xs text-slate-500">{itemDetail(next)}</p>
            </div>
            <ArrowRight size={16} className="ec-chevron ml-auto shrink-0 text-sky-400/70" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{current ? 'End of the show flow' : 'Show flow is empty'}</p>
        )}
      </div>

      <div className="rounded-xl bg-gradient-to-br from-amber-500/[0.09] to-transparent p-4 ring-1 ring-amber-400/15 ring-inset">
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
        <p key={current?.id ?? 'none'} className="ec-fade-up mt-2 text-sm whitespace-pre-wrap text-amber-50/90" style={{ animationDuration: '450ms' }}>
          {current?.notes ? current.notes : <span className="text-slate-500">{current ? 'No notes for this item.' : 'Select a show flow item.'}</span>}
        </p>
        <p className="mt-2 text-[10px] text-slate-600">Visible to operators only — never shown on the display.</p>
      </div>
    </div>
  );
}
