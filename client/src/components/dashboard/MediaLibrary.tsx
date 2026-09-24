import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { AlertTriangle, Download, ExternalLink, FolderOpen, MoreHorizontal, Pencil, Play, Plus, Star, Trash2, UploadCloud } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { TextInput } from '../ui/Field';
import { MediaIcon, mediaKindLabel } from '../MediaIcon';
import { ACCEPTED_FILE_TYPES } from '../../services/api';
import { formatBytes } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Media } from '../../types';

interface MediaLibraryProps {
  media: Media[];
  logoMediaId: string | null;
  queuedMediaIds: Set<string>;
  uploadProgress: number | null;
  onUpload: (files: File[]) => void;
  onAddToQueue: (media: Media) => void;
  onShowNow: (media: Media) => void;
  onOpen: (media: Media) => void;
  onRename: (media: Media, name: string) => Promise<void>;
  onSetLogo: (media: Media | null) => void;
  onDelete: (media: Media) => void;
  className?: string;
}

export function MediaLibrary(props: MediaLibraryProps) {
  const { media, uploadProgress, onUpload, className } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState<Media | null>(null);
  const dragDepth = useRef(0);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onUpload(files);
  };

  return (
    <Panel
      title="Media library"
      icon={<FolderOpen size={14} />}
      className={className}
      bodyClassName="scroll-thin overflow-y-auto"
      actions={
        <>
          <span className="mr-2 hidden text-xs text-slate-500 sm:inline">{media.length} files</span>
          <Button size="sm" variant="primary" icon={<UploadCloud size={14} />} onClick={() => inputRef.current?.click()} disabled={uploadProgress !== null}>
            {uploadProgress !== null ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Upload'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) onUpload(files);
            }}
          />
        </>
      }
    >
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn('relative min-h-32 rounded-xl transition-colors', dragging && 'bg-sky-500/5 ring-2 ring-sky-400/60 ring-dashed')}
      >
        {uploadProgress !== null && (
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-sky-400 transition-[width]" style={{ width: `${uploadProgress * 100}%` }} />
          </div>
        )}
        {media.length === 0 ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500 hover:border-sky-400/40 hover:text-slate-300"
          >
            <UploadCloud size={28} className="mb-2" />
            Drop files here or click to upload
            <span className="mt-1 text-xs text-slate-600">PPT, PPTX, PDF, PNG, JPG, WEBP, MP4, WEBM, MOV</span>
          </button>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 min-[1900px]:grid-cols-4">
            {media.map((m) => (
              <MediaCard key={m.id} {...props} item={m} onStartRename={() => setRenaming(m)} />
            ))}
          </ul>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-console-950/70 text-sm font-medium text-sky-300">
            Drop to upload
          </div>
        )}
      </div>
      <RenameModal media={renaming} onClose={() => setRenaming(null)} onRename={props.onRename} />
    </Panel>
  );
}

function MediaCard({
  item: media,
  logoMediaId,
  queuedMediaIds,
  onAddToQueue,
  onShowNow,
  onOpen,
  onSetLogo,
  onDelete,
  onStartRename,
}: Omit<MediaLibraryProps, 'media'> & { item: Media; onStartRename: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isLogo = logoMediaId === media.id;
  const queued = queuedMediaIds.has(media.id);

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-console-850 p-2.5 hover:border-white/10">
      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-black/40">
        {media.kind === 'image' && !media.missing ? (
          <img src={media.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MediaIcon kind={media.kind} size={14} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100" title={media.name}>
          {media.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] whitespace-nowrap text-slate-500">
          {media.missing ? (
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle size={11} /> File missing
            </span>
          ) : (
            <>
              <span>{mediaKindLabel(media.kind)}</span>·<span>{formatBytes(media.size)}</span>
            </>
          )}
          {isLogo && <Badge tone="violet">Logo</Badge>}
          {queued && <Badge tone="neutral">Queued</Badge>}
        </div>
      </div>
      <div className="flex items-center">
        <Button size="sm" variant="ghost" onClick={() => onAddToQueue(media)} title="Add to queue" className="px-2">
          <Plus size={14} /> Queue
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => onShowNow(media)} title="Show on display now" aria-label={`Show ${media.name} now`}>
          <Play size={14} />
        </Button>
        <div className="relative">
          <Button size="icon-sm" variant="ghost" onClick={() => setMenuOpen((o) => !o)} aria-label="More actions">
            <MoreHorizontal size={14} />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-white/10 bg-console-800 py-1 text-sm shadow-xl" onClick={() => setMenuOpen(false)}>
                <MenuItem icon={<ExternalLink size={14} />} onClick={() => onOpen(media)}>
                  {media.kind === 'presentation' ? 'Open in PowerPoint' : 'Open in new tab'}
                </MenuItem>
                <MenuItem icon={<Download size={14} />} onClick={() => window.open(`${media.url}?download=1`, '_blank')}>
                  Download
                </MenuItem>
                <MenuItem icon={<Pencil size={14} />} onClick={onStartRename}>
                  Rename
                </MenuItem>
                {media.kind === 'image' && (
                  <MenuItem icon={<Star size={14} />} onClick={() => onSetLogo(isLogo ? null : media)}>
                    {isLogo ? 'Unset event logo' : 'Use as event logo'}
                  </MenuItem>
                )}
                <MenuItem icon={<Trash2 size={14} />} onClick={() => onDelete(media)} danger>
                  Delete
                </MenuItem>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5', danger && 'text-red-300 hover:bg-red-500/10')}>
      {icon}
      {children}
    </button>
  );
}

function RenameModal({ media, onClose, onRename }: { media: Media | null; onClose: () => void; onRename: (m: Media, name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (media && media.id !== lastId) {
    setLastId(media.id);
    setName(media.name);
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!media || !name.trim()) return;
    await onRename(media, name.trim());
    onClose();
    setLastId(null);
  };
  return (
    <Modal
      open={!!media}
      onClose={() => (onClose(), setLastId(null))}
      title="Rename media"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="rename-form" disabled={!name.trim()}>
            Rename
          </Button>
        </>
      }
    >
      <form id="rename-form" onSubmit={submit}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </form>
    </Modal>
  );
}
