import type { Media, PublicMedia, QueueItem } from '../types';
import { formatDurationShort } from './format';

/** "slide" for PowerPoint decks, "page" for PDFs. */
export const pageWord = (m: Pick<Media, 'kind'> | Pick<PublicMedia, 'kind'> | null | undefined, plural = false) =>
  (m?.kind === 'presentation' ? 'slide' : 'page') + (plural ? 's' : '');

export function itemLabel(item: QueueItem): string {
  if (item.kind === 'screen') return item.title || item.screen?.title || 'Screen';
  return item.title || item.media?.name || 'Untitled';
}

/** "Slides 1–8", "Pages 3–5", "Screen · 30 sec"… */
export function itemDetail(item: QueueItem): string {
  const parts: string[] = [];
  if (item.kind === 'screen') {
    parts.push('Screen');
  } else if (item.media) {
    const count = item.media.pageCount;
    if (count && item.media.pdfUrl) {
      const start = Math.min(item.startPage ?? 1, count);
      const end = Math.min(item.endPage ?? count, count);
      const word = pageWord(item.media, true);
      parts.push(`${word[0].toUpperCase()}${word.slice(1)} ${start}–${end}`);
    } else if (item.media.kind === 'presentation' && item.media.conversionStatus === 'pending') {
      parts.push('Converting slides…');
    } else {
      parts.push(item.media.kind === 'video' ? 'Video' : item.media.kind === 'image' ? 'Image' : 'Presentation');
    }
  }
  if (item.durationSeconds) parts.push(formatDurationShort(item.durationSeconds));
  return parts.join(' · ');
}
