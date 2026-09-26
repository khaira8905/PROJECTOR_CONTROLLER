import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Folder, Loader2, RefreshCw, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Pending } from '../ui/Pending';
import { DriveIcon } from '../DriveIcon';
import { MediaIcon } from '../MediaIcon';
import { ApiError, api } from '../../services/api';
import { cn } from '../../lib/cn';
import { formatBytes } from '../../lib/format';
import type { DriveFile, GoogleStatus } from '../../types';

type Crumb = { id: string; name: string };

/**
 * Browse the connected Google Drive and import presentations. Folders open in place;
 * search looks across the whole Drive. Imported files are copied onto this computer,
 * so they convert to slides and keep working if the venue Wi-Fi drops.
 */
export function DriveBrowser({
  open,
  status,
  onClose,
  onImport,
  onStatusChange,
}: {
  open: boolean;
  status: GoogleStatus | null;
  onClose: () => void;
  onImport: (fileIds: string[]) => Promise<void>;
  onStatusChange: () => void;
}) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: 'root', name: 'My Drive' }]);
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; reconnect?: boolean } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const request = useRef(0);
  const folder = crumbs[crumbs.length - 1];
  const ready = !!status?.configured && !!status.connected && status.drive;

  const load = useCallback(
    async (pageToken?: string) => {
      const id = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api.driveList({ q: query.trim() || undefined, folderId: query.trim() ? undefined : folder.id, pageToken });
        if (id !== request.current) return; // a newer search/folder won
        setFiles((prev) => (pageToken ? [...prev, ...res.files] : res.files));
        setNext(res.nextPageToken);
      } catch (err) {
        if (id !== request.current) return;
        const reconnect = err instanceof ApiError && err.code === 'GOOGLE_RECONNECT';
        setError({ message: err instanceof Error ? err.message : 'Couldn’t load your Drive.', reconnect });
        if (reconnect) onStatusChange();
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [folder.id, query, onStatusChange],
  );

  useEffect(() => {
    if (!open || !ready) return;
    const t = window.setTimeout(() => void load(), query ? 300 : 0); // debounce typing
    return () => window.clearTimeout(t);
  }, [open, ready, load, query]);

  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  const connectUrl = api.googleConnectUrl(`${window.location.pathname}${window.location.search}${window.location.search ? '&' : '?'}drive=open`);
  const importable = files.filter((f) => f.kind !== 'folder');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <DriveIcon size={20} /> Google Drive
          {status?.account && <span className="text-sm font-normal text-slate-500">· {status.account.email}</span>}
        </span>
      }
      footer={
        ready ? (
          <>
            <span className="mr-auto text-sm text-slate-500">{picked.length ? `${picked.length} selected` : 'PowerPoint, Google Slides and PDF'}</span>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!picked.length || importing}
              icon={importing ? <Loader2 size={15} className="animate-spin" /> : undefined}
              onClick={async () => {
                setImporting(true);
                try {
                  await onImport(picked);
                  onClose();
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? 'Importing…' : picked.length > 1 ? `Import ${picked.length} files` : 'Import'}
            </Button>
          </>
        ) : undefined
      }
    >
      {!status ? (
        <div className="flex h-40 items-center justify-center">
          <Pending label="Checking your Google connection…" />
        </div>
      ) : !status.configured ? (
        <Notice title="Google isn’t set up on this server yet">
          The person who installed EventControl needs to add a Google OAuth client (<code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>) to the <code>.env</code> file and restart. The README section “Google Drive” walks through it in five minutes.
        </Notice>
      ) : !ready ? (
        <Notice title={status.connected ? 'Drive access wasn’t granted' : 'Connect your Google account'} action={<a href={connectUrl} className="ec-btn ec-btn-primary inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold">Connect Google Drive</a>}>
          {status.connected
            ? 'Your Google account is connected, but without permission to see Drive files. Connect again and allow access to your Drive.'
            : 'You’ll be sent to Google to choose an account and allow EventControl to see your Drive files (read-only). You come straight back here afterwards.'}
        </Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm" aria-label="Folder">
              {query ? (
                <span className="text-slate-400">Search results across your Drive</span>
              ) : (
                crumbs.map((c, i) => (
                  <span key={c.id} className="flex min-w-0 items-center gap-1">
                    {i > 0 && <ChevronRight size={14} className="shrink-0 text-slate-600" />}
                    <button
                      className={cn('truncate rounded px-1 py-0.5', i === crumbs.length - 1 ? 'font-semibold text-white' : 'text-slate-400 hover:text-white')}
                      onClick={() => setCrumbs((cs) => cs.slice(0, i + 1))}
                      disabled={i === crumbs.length - 1}
                    >
                      {c.name}
                    </button>
                  </span>
                ))
              )}
            </nav>
            <Button size="icon-sm" variant="ghost" onClick={() => void load()} disabled={loading} aria-label="Refresh" title="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin' : undefined} />
            </Button>
            <label className="relative w-60 max-sm:w-full">
              <span className="sr-only">Search Drive</span>
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Drive…"
                className="h-9 w-full rounded-md border border-[var(--line-strong)] bg-console-900 pr-3 pl-9 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </label>
          </div>

          <ul className="mt-3 h-[46vh] divide-y divide-[var(--line)] overflow-y-auto rounded-md border border-[var(--line)]">
            {error ? (
              <li className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertTriangle className="text-amber-400" />
                <p className="max-w-md text-sm text-slate-300">{error.message}</p>
                {error.reconnect ? (
                  <a href={connectUrl} className="ec-btn ec-btn-primary inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold">
                    Connect again
                  </a>
                ) : (
                  <Button size="sm" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />} onClick={() => void load()} disabled={loading}>
                    Try again
                  </Button>
                )}
              </li>
            ) : loading && files.length === 0 ? (
              Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-3">
                  <span className="ec-skeleton h-5 w-5 rounded-[3px]" />
                  <span className="ec-skeleton h-3 rounded-[2px]" style={{ width: `${30 + ((i * 17) % 40)}%` }} />
                </li>
              ))
            ) : files.length === 0 ? (
              <li className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                {query ? `No presentations or PDFs match “${query}”.` : 'No presentations, PDFs or folders here.'}
              </li>
            ) : (
              files.map((f) => {
                if (f.kind === 'folder')
                  return (
                    <li key={f.id}>
                      <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--row-hover)]" onClick={() => setCrumbs((cs) => [...cs, { id: f.id, name: f.name }])}>
                        <Folder size={18} className="shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{f.name}</span>
                        <ChevronRight size={15} className="text-slate-600" />
                      </button>
                    </li>
                  );
                const selected = picked.includes(f.id);
                return (
                  <li key={f.id}>
                    <button
                      aria-pressed={selected}
                      className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors', selected ? 'bg-[var(--row-active)]' : 'hover:bg-[var(--row-hover)]')}
                      onClick={() => setPicked((p) => (selected ? p.filter((x) => x !== f.id) : [...p, f.id]))}
                    >
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border', selected ? 'border-sky-500 bg-sky-500 text-[#fff]' : 'border-[var(--line-strong)]')}>
                        {selected && <Check size={13} strokeWidth={3} />}
                      </span>
                      <MediaIcon kind={f.kind === 'pdf' ? 'pdf' : 'presentation'} size={12} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{f.name}</span>
                        <span className="block text-xs text-slate-500">
                          {f.kind === 'slides' ? 'Google Slides — imported as PowerPoint' : f.kind === 'pdf' ? 'PDF' : 'PowerPoint'}
                          {f.size ? ` · ${formatBytes(f.size)}` : ''}
                          {f.modifiedTime ? ` · edited ${new Date(f.modifiedTime).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
            {next && !error && (
              <li className="p-2 text-center">
                <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load(next)}>
                  {loading ? 'Loading…' : 'Load more'}
                </Button>
              </li>
            )}
          </ul>
          {importable.length > 0 && !picked.length && <p className="mt-2 text-xs text-slate-500">Tip: pick several files, then import them together.</p>}
        </>
      )}
    </Modal>
  );
}

function Notice({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <DriveIcon size={36} />
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-slate-400 [&_code]:rounded [&_code]:bg-console-700 [&_code]:px-1 [&_code]:text-[12px]">{children}</p>
      {action}
    </div>
  );
}
