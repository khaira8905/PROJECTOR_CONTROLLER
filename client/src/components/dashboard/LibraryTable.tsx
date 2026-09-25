import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Eye, FolderOpen, Loader2, MoreHorizontal, Play, Plus, Search, Trash2, Upload, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { MediaIcon } from '../MediaIcon';
import { cn } from '../../lib/cn';
import { formatBytes } from '../../lib/format';
import type { Media, MediaKind } from '../../types';

interface LibraryTableProps {
  media: Media[];
  flowMediaIds: Set<string>;
  uploadProgress: number | null;
  onUpload: (files: File[]) => void;
  onPreview: (m: Media) => void;
  onShowNow: (m: Media) => void;
  onAddToFlow: (m: Media) => void;
  onOpen: (m: Media) => void;
  onDelete: (m: Media) => void;
  /** Opens the full library (folders, renaming, branding). */
  onManage: () => void;
  className?: string;
}

const TABS: { value: MediaKind; label: string }[] = [
  { value: 'presentation', label: 'Presentations' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
];

const ACCEPT = '.ppt,.pptx,.pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov';

/** The event's files as a compact table: find one, show it now, or add it to the flow. */
export function LibraryTable({ media, flowMediaIds, uploadProgress, onUpload, onPreview, onShowNow, onAddToFlow, onOpen, onDelete, onManage, className }: LibraryTableProps) {
  const counts = useMemo(() => {
    const c: Record<MediaKind, number> = { presentation: 0, pdf: 0, image: 0, video: 0 };
    for (const m of media) c[m.kind] = (c[m.kind] ?? 0) + 1;
    return c;
  }, [media]);
  const [tab, setTab] = useState<MediaKind>(() => TABS.find((t) => counts[t.value] > 0)?.value ?? 'presentation');
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  // A search looks across every type; otherwise the selected tab.
  const rows = media
    .filter((m) => (q ? m.name.toLowerCase().includes(q) : m.kind === tab))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onUpload(files);
  };

  return (
    <section
      className={cn('ec-card relative flex min-h-0 flex-col rounded-xl', className)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] px-3 pt-2">
        <div className="-mb-px flex min-w-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTab(t.value);
                setQuery('');
              }}
              className={cn(
                'relative shrink-0 px-3.5 pt-2 pb-2.5 text-sm transition-colors',
                !q && tab === t.value ? 'font-semibold text-sky-300' : 'text-slate-400 hover:text-white',
              )}
            >
              {t.label}
              {counts[t.value] > 0 && <span className="ml-1.5 text-xs text-slate-500 tabular-nums">{counts[t.value]}</span>}
              {!q && tab === t.value && <span className="ec-rise-in absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-sky-500" />}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 pb-2">
          <label className="relative block">
            <span className="sr-only">Search files</span>
            <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              className="h-9 w-44 rounded-md border border-[var(--line)] bg-console-850 pr-2 pl-8 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:bg-console-900 focus:outline-none xl:w-56"
            />
          </label>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) onUpload(files);
            }}
          />
          <Button variant="primary" size="sm" className="h-9 px-4" icon={<Upload size={15} />} onClick={() => input.current?.click()} disabled={uploadProgress !== null}>
            {uploadProgress !== null ? `${Math.round(uploadProgress * 100)}%` : 'Upload'}
          </Button>
          <Button variant="ghost" size="icon-sm" className="h-9 w-9" onClick={onManage} aria-label="Open the full library" title="Folders, renaming and branding">
            <FolderOpen size={17} />
          </Button>
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="h-0.5 bg-console-600">
          <div className="h-full bg-sky-500 transition-[width]" style={{ width: `${uploadProgress * 100}%` }} />
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <button onClick={() => input.current?.click()} className="flex h-full min-h-28 w-full flex-col items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-300">
            <Upload size={20} />
            {q ? `No files match “${query}”.` : `No ${TABS.find((t) => t.value === tab)!.label.toLowerCase()} yet — drop files here or click to upload.`}
          </button>
        ) : (
          <table className="ec-table w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th className="py-2 pl-4 font-medium">Name</th>
                <th className="w-20 py-2 font-medium">Type</th>
                <th className="w-28 py-2 font-medium">Slides/Pages</th>
                <th className="w-24 py-2 font-medium">Size</th>
                <th className="w-44 py-2 font-medium">Last Modified</th>
                <th className="w-32 py-2 pr-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="group" onDoubleClick={() => onPreview(m)}>
                  <td className="py-1.5 pl-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MediaIcon kind={m.kind} size={11} />
                      <span className="truncate font-medium text-slate-100" title={m.name}>
                        {m.name}
                      </span>
                      {flowMediaIds.has(m.id) && <span className="shrink-0 rounded bg-sky-500/12 px-1.5 text-[11px] font-medium text-sky-300">In flow</span>}
                      {m.missing && <span className="shrink-0 text-xs text-red-400">Missing</span>}
                    </div>
                  </td>
                  <td className="py-1.5 text-slate-400">{extension(m)}</td>
                  <td className="py-1.5 text-slate-400 tabular-nums">
                    <Pages media={m} />
                  </td>
                  <td className="py-1.5 text-slate-400 tabular-nums">{formatBytes(m.size)}</td>
                  <td className="py-1.5 text-slate-400">{modifiedLabel(m.createdAt)}</td>
                  <td className="py-1 pr-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <Button size="icon-sm" variant="ghost" onClick={() => onShowNow(m)} aria-label={`Show ${m.name} now`} title="Show on the display now">
                          <Play size={14} />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => onAddToFlow(m)} aria-label={`Add ${m.name} to the show flow`} title="Add to the show flow">
                          <Plus size={15} />
                        </Button>
                      </span>
                      <div className="relative">
                        <Button size="icon-sm" variant="ghost" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} aria-label={`More actions for ${m.name}`}>
                          <MoreHorizontal size={16} />
                        </Button>
                        {menuFor === m.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="ec-card ec-card-raised ec-pop-in absolute right-0 z-20 mt-1 w-48 origin-top-right overflow-hidden rounded-lg py-1 text-sm" onClick={() => setMenuFor(null)}>
                              <MenuItem icon={<Eye size={14} />} onClick={() => onPreview(m)}>
                                Preview
                              </MenuItem>
                              <MenuItem icon={<Play size={14} />} onClick={() => onShowNow(m)}>
                                Show now
                              </MenuItem>
                              <MenuItem icon={<Plus size={14} />} onClick={() => onAddToFlow(m)}>
                                Add to show flow
                              </MenuItem>
                              <MenuItem icon={<ExternalLink size={14} />} onClick={() => onOpen(m)}>
                                {m.kind === 'presentation' ? 'Open in PowerPoint' : 'Open file'}
                              </MenuItem>
                              <div className="my-1 border-t border-[var(--line)]" />
                              <MenuItem icon={<Trash2 size={14} />} onClick={() => onDelete(m)} danger>
                                Delete
                              </MenuItem>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-sky-500 bg-console-900/85 text-sm font-medium text-sky-300">
          Drop to upload
        </div>
      )}
    </section>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--row-hover)]', danger ? 'text-red-400' : 'text-slate-200')}>
      {icon}
      {children}
    </button>
  );
}

function Pages({ media }: { media: Media }) {
  if (media.pageCount) return <>{media.pageCount}</>;
  if (media.kind === 'presentation' && media.conversionStatus === 'pending')
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-500">
        <Loader2 size={12} className="animate-spin" /> Converting
      </span>
    );
  if (media.kind === 'presentation') return <span className="text-amber-400" title={media.conversionError ?? undefined}>Not converted</span>;
  return <>{media.kind === 'image' ? 1 : '—'}</>;
}

function extension(m: Media) {
  const ext = m.originalName.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : m.kind === 'presentation' ? 'PPTX' : m.kind.toUpperCase();
}

function modifiedLabel(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}
