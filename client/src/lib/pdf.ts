// The legacy build includes polyfills for older browsers (projector laptops are rarely up to date).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Loaded documents are kept, so page flips and thumbnails are instant.
const documents = new Map<string, Promise<PDFDocumentProxy>>();

export function loadDocument(url: string): Promise<PDFDocumentProxy> {
  let doc = documents.get(url);
  if (!doc) {
    doc = pdfjs.getDocument({ url }).promise;
    doc.catch(() => documents.delete(url));
    documents.set(url, doc);
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
