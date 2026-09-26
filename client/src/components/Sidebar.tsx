import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, FolderOpen, LayoutGrid, LogOut, MonitorPlay, Palette, Settings } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatBytes } from '../lib/format';

export type DashboardView = 'control' | 'files' | 'screens' | 'branding' | 'timers' | 'settings';

export const NAV: { id: DashboardView; label: string; icon: typeof MonitorPlay }[] = [
  { id: 'control', label: 'Control', icon: MonitorPlay },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'screens', label: 'Screens', icon: LayoutGrid },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'timers', label: 'Timers', icon: Clock3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  view: DashboardView;
  onView: (v: DashboardView) => void;
  logoUrl: string | null;
  eventName: string;
  disk: { free: number; total: number } | null | undefined;
  signedIn: boolean;
  operator: { name: string; picture: string | null } | null;
  onSignOut: () => void;
}

/**
 * A narrow rail: the console's sections with a label under every icon (no guessing),
 * free disk space and the operator. Leaves the width to the Flow.
 */
export function Sidebar({ view, onView, logoUrl, eventName, disk, signedIn, operator, onSignOut }: SidebarProps) {
  const [menu, setMenu] = useState(false);
  const used = disk && disk.total > 0 ? 1 - disk.free / disk.total : null;
  const initials = (operator?.name ?? 'Operator')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="ec-sidebar sticky top-0 flex h-dvh w-[84px] shrink-0 flex-col items-stretch max-lg:hidden">
      <Link to="/" className="group flex flex-col items-center gap-1 border-b border-[var(--sidebar-border)] px-2 py-3" title={`${eventName} — back to all events`}>
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-[5px] bg-[#fff] object-contain p-0.5" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-[#2a5bd7] text-[#fff]">
            <MonitorPlay size={20} />
          </span>
        )}
        <span className="ec-sidebar-muted flex items-center gap-0.5 text-[10.5px] group-hover:text-[var(--sidebar-strong)]">
          <ArrowLeft size={10} className="transition-transform group-hover:-translate-x-0.5" /> Events
        </span>
      </Link>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 py-3" aria-label="Console sections">
        <ul className="grid gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button className="ec-rail-item w-full" aria-current={view === id ? 'page' : undefined} onClick={() => onView(id)}>
                <Icon size={21} strokeWidth={1.7} />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {disk && used !== null && (
        <div className="px-3 pb-3" title={`${formatBytes(disk.free)} free of ${formatBytes(disk.total)} on this computer`}>
          <p className="ec-sidebar-muted text-center text-[10.5px] leading-tight tabular-nums">
            {formatBytes(disk.free)}
            <br />
            free
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#fff]/10">
            <div className={cn('h-full', used > 0.9 ? 'bg-[#f04438]' : 'bg-[#4f8bff]')} style={{ width: `${Math.max(4, used * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="relative border-t border-[var(--sidebar-border)] p-2">
        <button className="flex w-full flex-col items-center gap-1 rounded-md py-1.5 hover:bg-[var(--sidebar-hover)]" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Operator menu">
          {operator?.picture ? (
            <img src={operator.picture} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a5bd7] text-[13px] font-semibold text-[#fff]">{initials}</span>
          )}
          <span className="ec-sidebar-muted max-w-full truncate px-1 text-[10.5px]">{operator?.name.split(' ')[0] ?? 'Operator'}</span>
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="ec-card ec-card-raised ec-pop-in absolute bottom-2 left-full z-20 ml-2 w-56 origin-bottom-left rounded-md py-1 text-sm">
              <p className="border-b ec-line px-3 py-2 text-xs text-slate-500">
                Signed in as <span className="font-medium text-slate-200">{operator?.name ?? 'Operator'}</span>
              </p>
              <Link to="/" className="flex items-center gap-2.5 px-3 py-2 text-slate-200 hover:bg-[var(--row-hover)]">
                <ArrowLeft size={14} /> All events
              </Link>
              {signedIn && (
                <button onClick={onSignOut} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:bg-[var(--row-hover)]">
                  <LogOut size={14} /> Sign out
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
