import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadDocument } from '../../lib/pdf';

interface PdfViewProps {
  url: string;
  page: number;
  onPageCount?: (count: number) => void;
  /** Rendered when the file cannot be loaded. */
  fallback: React.ReactNode;
}

/** Renders one PDF page, scaled to fit its container (letterboxed on black). */
export function PdfView({ url, page, onPageCount, fallback }: PdfViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [rendered, setRendered] = useState(false);
  const onPageCountRef = useRef(onPageCount);
  onPageCountRef.current = onPageCount;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setRendered(false);
    setDoc(null);
    loadDocument(url)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        onPageCountRef.current?.(d.numPages);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || size.w === 0 || size.h === 0) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    const pageNumber = Math.min(Math.max(1, page), doc.numPages);
    doc
      .getPage(pageNumber)
      .then((p) => {
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const scale = Math.min(size.w / base.width, size.h / base.height);
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: scale * dpr });
        // Render off-screen, then copy: pdf.js refuses concurrent renders into one canvas,
        // and the visible page never flashes blank between pages.
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(viewport.width);
        offscreen.height = Math.floor(viewport.height);
        task = p.render({ canvas: offscreen, canvasContext: offscreen.getContext('2d')!, viewport });
        return task.promise.then(() => {
          const visible = canvasRef.current;
          if (cancelled || !visible) return;
          visible.width = offscreen.width;
          visible.height = offscreen.height;
          visible.style.width = `${Math.floor(viewport.width / dpr)}px`;
          visible.style.height = `${Math.floor(viewport.height / dpr)}px`;
          visible.getContext('2d')!.drawImage(offscreen, 0, 0);
          setRendered(true);
        });
      })
      .catch((err) => {
        if (err?.name !== 'RenderingCancelledException') console.warn('PDF page render failed', err);
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, size]);

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center">
      {failed ? fallback : <canvas ref={canvasRef} className={rendered ? 'bg-white shadow-2xl' : 'invisible'} />}
    </div>
  );
}
