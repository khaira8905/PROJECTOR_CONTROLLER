import { FileText, Film, Image as ImageIcon, Presentation } from 'lucide-react';
import type { MediaKind } from '../types';
import { cn } from '../lib/cn';

const config: Record<MediaKind, { icon: typeof FileText; className: string; label: string }> = {
  presentation: { icon: Presentation, className: 'text-orange-300 bg-orange-500/10 ring-orange-500/20', label: 'Presentation' },
  pdf: { icon: FileText, className: 'text-rose-300 bg-rose-500/10 ring-rose-500/20', label: 'PDF' },
  video: { icon: Film, className: 'text-violet-300 bg-violet-500/10 ring-violet-500/20', label: 'Video' },
  image: { icon: ImageIcon, className: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20', label: 'Image' },
};

export const mediaKindLabel = (kind: MediaKind) => config[kind]?.label ?? kind;

export function MediaIcon({ kind, size = 16, className }: { kind: MediaKind; size?: number; className?: string }) {
  const { icon: Icon, className: tone } = config[kind] ?? config.image;
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', tone, className)} style={{ width: size * 2, height: size * 2 }} aria-label={config[kind]?.label}>
      <Icon size={size} />
    </span>
  );
}
