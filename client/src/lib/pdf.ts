// The legacy build includes polyfills for older browsers (projector laptops are rarely up to date).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Recently used documents stay loaded so page flips and thumbnails are instant. Older ones
// are released: switching between many decks during a long event must not grow memory forever.
const MAX_DOCUMENTS = 8;
const documents = new Map<string, Promise<PDFDocumentProxy>>();

export function loadDocument(url: string): Promise<PDFDocumentProxy> {
  let doc = documents.get(url);
  if (doc) {
    // Map order doubles as recency: move this one to the end.
    documents.delete(url);
    documents.set(url, doc);
    return doc;
  }
  doc = pdfjs.getDocument({ url }).promise;
  doc.catch(() => documents.delete(url));
  documents.set(url, doc);
  while (documents.size > MAX_DOCUMENTS) {
    const [oldest, stale] = documents.entries().next().value!;
    documents.delete(oldest);
    // Give anything still drawing from it a moment to finish.
    window.setTimeout(() => void stale.then((d) => d.destroy()).catch(() => undefined), 5000);
  }
  return doc;
}

// Thumbnails render one at a time so a 60-slide deck never stalls the dashboard.
let chain: Promise<unknown> = Promise.resolve();

export function renderThumbnail(url: string, page: number, width: number): Promise<HTMLCanvasElement> {
  const job = chain.then(async () => {
    const doc = await loadDocument(url);
    const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
    const base = p.getViewport({ scale: 1 });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewport = p.getViewport({ scale: (width / base.width) * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await p.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    return canvas;
  });
  chain = job.catch(() => undefined);
  return job;
}
