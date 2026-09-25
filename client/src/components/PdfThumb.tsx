import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { cn } from '../lib/cn';

/** A lazily rendered PDF page thumbnail (pdf.js is only loaded when the first one scrolls into view). */
export function PdfThumb({ url, page, width, className }: { url: string; page: number; width: number; className?: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    import('../lib/pdf')
      .then(({ renderThumbnail }) => renderThumbnail(url, page, width))
      .then((canvas) => {
        if (cancelled || !holder.current) return;
        canvas.className = 'h-full w-full object-contain';
        holder.current.replaceChildren(canvas);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [visible, url, page, width]);

  return (
    <div ref={holder} className={cn('flex items-center justify-center bg-white/5', className)}>
      {failed && <FileText size={16} className="text-slate-500" />}
    </div>
  );
}
