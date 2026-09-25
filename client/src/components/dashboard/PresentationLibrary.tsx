import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { AlertTriangle, Cloud, CloudOff, Download, ExternalLink, Eye, Folder, FolderInput, FolderOpen, Loader2, MoreHorizontal, Pencil, Play, Plus, RefreshCw, Star, Trash2, UploadCloud } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { TextInput } from '../ui/Field';
import { MediaIcon, mediaKindLabel } from '../MediaIcon';
import { PdfThumb } from '../PdfThumb';
import { ACCEPTED_FILE_TYPES } from '../../services/api';
import { formatBytes } from '../../lib/format';
import { pageWord } from '../../lib/flow';
import { cn } from '../../lib/cn';
import type { Media } from '../../types';

export const DEFAULT_FOLDERS = ['Main Presentation', 'Speaker 1', 'Speaker 2', 'Sponsors', 'Break Screens', 'Emergency Screens', 'Logos', 'Event Branding'];

interface Props {
  media: Media[];
  logoMediaId: string | null;
  overlayMediaId: string | null;
  flowMediaIds: Set<string>;
  cloudEnabled: boolean;
  uploadProgress: number | null;
  onUpload: (files: File[], folder: string) => void;
  onPreview: (media: Media) => void;
  onAddToFlow: (media: Media) => void;
  onShowNow: (media: Media) => void;
  onOpen: (media: Media) => void;
  onRename: (media: Media, name: string) => Promise<void>;
  onMove: (media: Media, folder: string) => Promise<void>;
  onSetLogo: (media: Media | null) => void;
  onSetOverlay: (media: Media) => void;
  onReconvert: (media: Media) => void;
  onDelete: (media: Media) => void;
  className?: string;
}

const ALL = '__all__';
const UNFILED = '';

export function PresentationLibrary(props: Props) {
  const { media, uploadProgress, onUpload, className } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>(ALL);
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState<Media | null>(null);
  const [moving, setMoving] = useState<Media | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const dragDepth = useRef(0);

  const folders = useMemo(() => {
    const used = media.map((m) => m.folder).filter(Boolean);
    return Array.from(new Set([...DEFAULT_FOLDERS, ...used, ...customFolders]));
  }, [media, customFolders]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    media.forEach((m) => (c[m.folder] = (c[m.folder] ?? 0) + 1));
    return c;
  }, [media]);

  const visible = folder === ALL ? media : media.filter((m) => m.folder === folder);
  // Presentations first: they are what the operator works with most.
  const sorted = [...visible].sort((a, b) => rank(a) - rank(b));
  const uploadFolder = folder === ALL ? UNFILED : folder;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onUpload(files, uploadFolder);
  };

  const addFolder = () => {
    const name = window.prompt('New folder name')?.trim().slice(0, 60);
    if (name) {
      setCustomFolders((f) => [...f, name]);
      setFolder(name);
    }
  };

  return (
    <Panel
      title="Presentations"
      icon={<FolderOpen size={14} />}
      className={className}
      bodyClassName="scroll-thin overflow-y-auto"
      actions={
        <>
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
              if (files.length) onUpload(files, uploadFolder);
            }}
          />
        </>
      }
    >
      {/* Folder tabs */}
      <div className="scroll-thin -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        <FolderTab label="All" count={media.length} active={folder === ALL} onClick={() => setFolder(ALL)} />
        {counts[UNFILED] ? <FolderTab label="Unfiled" count={counts[UNFILED]} active={folder === UNFILED} onClick={() => setFolder(UNFILED)} /> : null}
        {folders.map((f) => (
          <FolderTab key={f} label={f} count={counts[f] ?? 0} active={folder === f} onClick={() => setFolder(f)} />
        ))}
        <button onClick={addFolder} className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-200" title="New folder">
          + Folder
        </button>
      </div>

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
            <div className="h-full bg-[linear-gradient(90deg,var(--accent-400),var(--accent-2))] transition-[width]" style={{ width: `${uploadProgress * 100}%` }} />
          </div>
        )}
        {sorted.length === 0 ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500 hover:border-sky-400/40 hover:text-slate-300"
          >
            <UploadCloud size={28} className="mb-2" />
            Drop files here or click to upload{folder !== ALL && folder ? ` to "${folder}"` : ''}
            <span className="mt-1 text-xs text-slate-600">PPT, PPTX, PDF, PNG, JPG, WEBP, MP4, WEBM, MOV</span>
          </button>
        ) : (
          <ul className="ec-stagger grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1700px]:grid-cols-3">
            {sorted.map((m) => (
              <PresentationCard key={m.id} {...props} item={m} onStartRename={() => setRenaming(m)} onStartMove={() => setMoving(m)} />
            ))}
          </ul>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-console-950/70 text-sm font-medium text-sky-300">
            Drop to upload{uploadFolder ? ` to "${uploadFolder}"` : ''}
          </div>
        )}
      </div>
      <RenameModal media={renaming} onClose={() => setRenaming(null)} onRename={props.onRename} />
      <MoveModal media={moving} folders={folders} onClose={() => setMoving(null)} onMove={props.onMove} />
    </Panel>
  );
}

const rank = (m: Media) => (m.kind === 'presentation' || m.kind === 'pdf' ? 0 : m.kind === 'video' ? 1 : 2);

function FolderTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-sky-500/20 text-white ring-1 ring-sky-400/35 ring-inset' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
      )}
    >
      {label}
      <span className={cn('font-mono text-[10px]', active ? 'text-sky-300' : 'text-slate-600')}>{count}</span>
    </button>
  );
}

function uploadedLabel(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0 && new Date().toDateString() === d.toDateString()) return 'Today';
  if (days <= 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Thumbnail({ media }: { media: Media }) {
  if (media.missing) return <AlertTriangle className="text-red-400" size={20} />;
  if (media.pdfUrl) return <PdfThumb url={media.pdfUrl} page={1} width={160} className="h-full w-full" />;
  if (media.kind === 'image') return <img src={media.url} alt="" loading="lazy" className="h-full w-full object-cover" />;
  if (media.kind === 'presentation' && media.conversionStatus === 'pending') return <Loader2 className="animate-spin text-slate-500" size={20} />;
  return <MediaIcon kind={media.kind} size={16} />;
}

function PresentationCard({
  item: media,
  logoMediaId,
  overlayMediaId,
  flowMediaIds,
  cloudEnabled,
  onPreview,
  onAddToFlow,
  onShowNow,
  onOpen,
  onSetLogo,
  onSetOverlay,
  onReconvert,
  onDelete,
  onStartRename,
  onStartMove,
}: Omit<Props, 'media'> & { item: Media; onStartRename: () => void; onStartMove: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const paged = !!media.pdfUrl && !!media.pageCount;

  let detail = mediaKindLabel(media.kind);
  if (paged) detail = `${media.pageCount} ${pageWord(media, media.pageCount !== 1)}`;
  else if (media.kind === 'presentation' && media.conversionStatus === 'pending') detail = 'Converting slides…';

  return (
    <li className="ec-card ec-card-raised ec-spot group flex flex-col overflow-hidden rounded-xl transition-[translate,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_24px_40px_-20px_rgba(0,0,0,0.8)]">
      <button onClick={() => onPreview(media)} className="relative flex aspect-video items-center justify-center overflow-hidden bg-black/50" title="Preview">
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/3 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
        <span className="flex h-full w-full items-center justify-center transition-transform duration-500 ease-out group-hover:scale-[1.04]">
          <Thumbnail media={media} />
        </span>
        <span className="absolute top-2 left-2">
          <MediaIcon kind={media.kind} size={11} className="bg-black/60" />
        </span>
        <span className="absolute top-2 right-2 flex gap-1">
          {logoMediaId === media.id && <Badge tone="violet">Logo</Badge>}
          {overlayMediaId === media.id && <Badge tone="violet">Overlay</Badge>}
          {flowMediaIds.has(media.id) && <Badge tone="info">In flow</Badge>}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-sm font-semibold text-slate-100" title={media.name}>
          {media.name}
        </p>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] whitespace-nowrap text-slate-500">
          <span className={cn(paged && 'text-slate-300')}>{detail}</span>·<span>{formatBytes(media.size)}</span>·<span>Uploaded {uploadedLabel(media.createdAt)}</span>
          {cloudEnabled && <CloudBadge media={media} />}
        </div>
        {media.kind === 'presentation' && (media.conversionStatus === 'failed' || media.conversionStatus === 'unavailable') && (
          <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] leading-snug text-amber-200">{media.conversionError}</p>
        )}
        {media.folder && (
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <Folder size={11} /> {media.folder}
          </p>
        )}
        <div className="mt-auto flex items-center gap-0.5 pt-2">
          <Button size="icon-sm" variant="ghost" onClick={() => onPreview(media)} title="Preview" aria-label={`Preview ${media.name}`}>
            <Eye size={15} />
          </Button>
          <Button size="sm" variant="ghost" className="px-2" icon={<Play size={14} />} onClick={() => onShowNow(media)} title="Show on the display now">
            Show
          </Button>
          <Button size="sm" variant="ghost" className="px-2" icon={<Plus size={14} />} onClick={() => onAddToFlow(media)} title="Add to the show flow">
            Flow
          </Button>
          <div className="relative ml-auto shrink-0">
            <Button size="icon-sm" variant="ghost" onClick={() => setMenuOpen((o) => !o)} aria-label="More actions">
              <MoreHorizontal size={15} />
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="ec-card ec-card-raised ec-pop-in absolute right-0 bottom-full z-20 mb-1 w-52 origin-bottom-right overflow-hidden rounded-xl py-1 text-sm" onClick={() => setMenuOpen(false)}>
                  <MenuItem icon={<ExternalLink size={14} />} onClick={() => onOpen(media)}>
                    {media.kind === 'presentation' ? 'Open in PowerPoint' : 'Open in new tab'}
                  </MenuItem>
                  {media.kind === 'presentation' && media.conversionStatus !== 'pending' && (
                    <MenuItem icon={<RefreshCw size={14} />} onClick={() => onReconvert(media)}>
                      {media.conversionStatus === 'ready' ? 'Re-create slides' : 'Retry slide conversion'}
                    </MenuItem>
                  )}
                  <MenuItem icon={<Download size={14} />} onClick={() => window.open(`${media.url}?download=1`, '_blank')}>
                    Download original
                  </MenuItem>
                  <MenuItem icon={<Pencil size={14} />} onClick={onStartRename}>
                    Rename
                  </MenuItem>
                  <MenuItem icon={<FolderInput size={14} />} onClick={onStartMove}>
                    Move to folder
                  </MenuItem>
                  {media.kind === 'image' && (
                    <>
                      <MenuItem icon={<Star size={14} />} onClick={() => onSetOverlay(media)}>
                        Use as logo overlay
                      </MenuItem>
                      <MenuItem icon={<Star size={14} />} onClick={() => onSetLogo(logoMediaId === media.id ? null : media)}>
                        {logoMediaId === media.id ? 'Unset full-screen logo' : 'Use as full-screen logo'}
                      </MenuItem>
                    </>
                  )}
                  <MenuItem icon={<Trash2 size={14} />} onClick={() => onDelete(media)} danger>
                    Delete
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function CloudBadge({ media }: { media: Media }) {
  if (media.cloudStatus === 'synced')
    return (
      <span className="flex items-center gap-0.5 text-emerald-400" title="Stored in the cloud">
        <Cloud size={11} /> Cloud
      </span>
    );
  if (media.cloudStatus === 'error')
    return (
      <span className="flex items-center gap-0.5 text-amber-400" title={media.cloudError ?? 'Cloud upload failed'}>
        <CloudOff size={11} /> Retrying
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-slate-400" title="Uploading to the cloud">
      <Loader2 size={11} className="animate-spin" /> Syncing
    </span>
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
  const close = () => {
    onClose();
    setLastId(null);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!media || !name.trim()) return;
    await onRename(media, name.trim());
    close();
  };
  return (
    <Modal
      open={!!media}
      onClose={close}
      title="Rename"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
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

function MoveModal({ media, folders, onClose, onMove }: { media: Media | null; folders: string[]; onClose: () => void; onMove: (m: Media, folder: string) => Promise<void> }) {
  const [custom, setCustom] = useState('');
  const move = async (folder: string) => {
    if (!media) return;
    await onMove(media, folder);
    setCustom('');
    onClose();
  };
  return (
    <Modal open={!!media} onClose={onClose} title={`Move "${media?.name ?? ''}"`} size="sm">
      <div className="grid gap-1">
        {['', ...folders].map((f) => (
          <button
            key={f || 'unfiled'}
            onClick={() => move(f)}
            className={cn('rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5', media?.folder === f && 'bg-sky-500/10 text-sky-200')}
          >
            {f || 'Unfiled'}
          </button>
        ))}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) void move(custom.trim().slice(0, 60));
          }}
        >
          <TextInput value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="New folder…" />
          <Button type="submit" variant="primary" disabled={!custom.trim()}>
            Move
          </Button>
        </form>
      </div>
    </Modal>
  );
}
