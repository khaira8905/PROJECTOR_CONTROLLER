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

/**
 * Renders one PDF page, scaled to fit its container (letterboxed on black).
 * Each page is rendered off-screen and then laid on top of the previous one with a
 * short drift in the direction of travel (next → from the right, previous → from the
 * left); the old page is removed once the new one has settled. No blank frames.
 */
export function PdfView({ url, page, onPageCount, fallback }: PdfViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const lastPage = useRef<number | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onPageCountRef = useRef(onPageCount);
  onPageCountRef.current = onPageCount;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDoc(null);
    lastPage.current = null;
    stackRef.current?.replaceChildren();
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
    // Ask the cache again rather than reusing `doc`: it marks this deck as in use, and returns
    // a fresh copy if an old one was released while other decks' thumbnails were loading.
    loadDocument(url)
      .then((d) => d.getPage(pageNumber))
      .then((p) => {
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const scale = Math.min(size.w / base.width, size.h / base.height);
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: scale * dpr });
        // Render off-screen (pdf.js refuses concurrent renders into one canvas), then show it.
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = p.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport });
        return task.promise.then(() => {
          const stack = stackRef.current;
          if (cancelled || !stack) return;
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          canvas.className = 'absolute inset-0 m-auto bg-white shadow-2xl';
          const previous = lastPage.current;
          const flipped = previous !== null && previous !== pageNumber;
          if (flipped) canvas.classList.add(pageNumber > previous ? 'ec-page-next' : 'ec-page-prev');
          lastPage.current = pageNumber;
          const old = Array.from(stack.children);
          stack.appendChild(canvas);
          // Resizes swap instantly; page flips keep the old page underneath until the new one lands.
          window.setTimeout(() => old.forEach((el) => el.remove()), flipped ? 420 : 0);
        });
      })
      .catch((err) => {
        if (err?.name !== 'RenderingCancelledException') console.warn('PDF page render failed', err);
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, url, page, size]);

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center">
      <div ref={stackRef} className={failed ? 'hidden' : 'absolute inset-0'} />
      {failed && fallback}
    </div>
  );
}
