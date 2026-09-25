import { Suspense, lazy, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ListPlus, Play } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { PdfThumb } from '../PdfThumb';
import { MediaIcon } from '../MediaIcon';
import { cn } from '../../lib/cn';
import { pageWord } from '../../lib/flow';
import type { Media } from '../../types';

const PdfView = lazy(() => import('../display/PdfView').then((m) => ({ default: m.PdfView })));

interface Props {
  media: Media | null;
  onClose: () => void;
  onShowPage: (media: Media, page: number) => void;
  onAddToFlow: (media: Media, start: number | null, end: number | null) => void;
}

/** Browse a presentation privately (the audience sees nothing) before putting it on air. */
export function PreviewModal({ media, onClose, onShowPage, onAddToFlow }: Props) {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    setPage(1);
    setFrom('');
    setTo('');
  }, [media?.id]);

  const count = media?.pdfUrl ? (media.pageCount ?? 1) : null;
  const word = pageWord(media);

  useEffect(() => {
    if (!media || !count) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') setPage((p) => Math.min(count, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media, count]);

  if (!media) return null;
  const range = (v: string) => (v ? Math.min(Math.max(1, Number(v)), count ?? 1) : null);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <MediaIcon kind={media.kind} size={12} /> {media.name}
          <span className="text-xs font-normal text-slate-500">Preview — not shown on the display</span>
        </span>
      }
      footer={
        <>
          {count && (
            <div className="mr-auto flex items-center gap-2 text-xs text-slate-400">
              Add {pageWord(media, true)}
              <TextInput value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} placeholder="1" className="h-8 w-14 text-center" aria-label="From" />
              to
              <TextInput value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} placeholder={String(count)} className="h-8 w-14 text-center" aria-label="To" />
            </div>
          )}
          <Button
            icon={<ListPlus size={15} />}
            onClick={() => {
              onAddToFlow(media, count ? range(from) : null, count ? range(to) : null);
              onClose();
            }}
          >
            Add to show flow
          </Button>
          <Button
            variant="primary"
            data-autofocus
            icon={<Play size={15} />}
            onClick={() => {
              onShowPage(media, page);
              onClose();
            }}
          >
            {count ? `Show ${word} ${page} live` : 'Show live'}
          </Button>
        </>
      }
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {media.pdfUrl ? (
          <Suspense fallback={null}>
            <PdfView url={media.pdfUrl} page={page} fallback={<p className="text-sm text-red-300">Unable to load this file.</p>} />
          </Suspense>
        ) : media.kind === 'image' ? (
          <img src={media.url} alt={media.name} className="absolute inset-0 h-full w-full object-contain" />
        ) : media.kind === 'video' ? (
          <video src={media.url} className="absolute inset-0 h-full w-full object-contain" controls muted />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-400">
            <MediaIcon kind={media.kind} size={20} />
            {media.conversionStatus === 'pending' ? 'Converting slides… this takes a few seconds.' : (media.conversionError ?? 'No preview available.')}
          </div>
        )}
      </div>
      {count && (
        <>
          <div className="mt-3 flex items-center justify-center gap-3">
            <Button size="icon-sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous">
              <ChevronLeft size={16} />
            </Button>
            <span className="font-mono text-sm text-slate-300">
              {word[0].toUpperCase() + word.slice(1)} {page} / {count}
            </span>
            <Button size="icon-sm" variant="ghost" onClick={() => setPage((p) => Math.min(count, p + 1))} disabled={page >= count} aria-label="Next">
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className="scroll-thin mt-3 flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: count }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={cn('relative w-24 shrink-0 overflow-hidden rounded-md ring-2', p === page ? 'ring-sky-400' : 'ring-transparent hover:ring-white/30')}>
                <PdfThumb url={media.pdfUrl!} page={p} width={96} className="aspect-video w-full" />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 font-mono text-[10px] text-[#fff]/85">{p}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
