import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, FileText, HardDrive, Image as ImageIcon, LayoutGrid, ListOrdered, LogOut, Monitor, Palette, Settings, Timer } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatBytes } from '../lib/format';

export type DashboardView = 'control' | 'presentations' | 'flow' | 'screens' | 'media' | 'branding' | 'timers' | 'settings';

export const NAV: { id: DashboardView; label: string; icon: typeof Monitor }[] = [
  { id: 'control', label: 'Control', icon: Monitor },
  { id: 'presentations', label: 'Presentations', icon: FileText },
  { id: 'flow', label: 'Show Flow', icon: ListOrdered },
  { id: 'screens', label: 'Screens', icon: LayoutGrid },
  { id: 'media', label: 'Media Library', icon: ImageIcon },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'timers', label: 'Timers', icon: Timer },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  view: DashboardView;
  onView: (v: DashboardView) => void;
  logoUrl: string | null;
  eventName: string;
  venue: string;
  disk: { free: number; total: number } | null | undefined;
  signedIn: boolean;
  onSignOut: () => void;
}

/** The console's left rail: event identity, the sections, storage and who is operating. */
export function Sidebar({ view, onView, logoUrl, eventName, venue, disk, signedIn, onSignOut }: SidebarProps) {
  const [menu, setMenu] = useState(false);
  const used = disk && disk.total > 0 ? 1 - disk.free / disk.total : null;

  return (
    <aside className="ec-sidebar sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col max-2xl:w-[76px] max-lg:hidden">
      <Link to="/" className="group flex items-center gap-3 border-b border-[var(--sidebar-border)] px-5 py-4 max-2xl:justify-center max-2xl:px-0" title="All events">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-md bg-[#fff] object-contain p-0.5" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#2a5bd7] text-[#fff]">
            <Monitor size={22} />
          </span>
        )}
        <span className="min-w-0 max-2xl:hidden">
          <span className="ec-sidebar-strong line-clamp-2 text-[14px] leading-snug font-semibold tracking-[0.01em] uppercase">{eventName}</span>
          <span className="ec-sidebar-muted mt-0.5 flex items-center gap-1 truncate text-xs">
            <ArrowLeft size={11} className="shrink-0 transition-transform group-hover:-translate-x-0.5" />
            {venue || 'All events'}
          </span>
        </span>
      </Link>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-4 max-2xl:px-2.5" aria-label="Console sections">
        <ul className="grid gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button className="ec-nav-item w-full max-2xl:justify-center max-2xl:px-0" aria-current={view === id ? 'page' : undefined} onClick={() => onView(id)} title={label}>
                <Icon size={20} strokeWidth={1.75} className="shrink-0" />
                <span className="max-2xl:sr-only">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {disk && used !== null && (
        <div className="px-5 pb-4 max-2xl:px-3" title={`${formatBytes(disk.free)} free of ${formatBytes(disk.total)}`}>
          <div className="flex items-center gap-2.5 max-2xl:justify-center">
            <HardDrive size={18} className="ec-sidebar-muted shrink-0" />
            <div className="min-w-0 text-[13px] max-2xl:hidden">
              <p className="ec-sidebar-strong font-medium">Storage</p>
              <p className="ec-sidebar-muted tabular-nums">
                {formatBytes(disk.free)} free of {formatBytes(disk.total)}
              </p>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#fff]/10">
            <div className={cn('h-full rounded-full', used > 0.9 ? 'bg-[#f04438]' : 'bg-[#4f8bff]')} style={{ width: `${Math.max(3, used * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="relative border-t border-[var(--sidebar-border)] p-3">
        <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[var(--sidebar-hover)] max-2xl:justify-center max-2xl:p-1" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Operator menu">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2a5bd7] text-sm font-semibold text-[#fff]">OP</span>
          <span className="min-w-0 flex-1 max-2xl:hidden">
            <span className="ec-sidebar-strong block text-sm font-medium">Operator</span>
            <span className="ec-sidebar-muted block text-xs">{signedIn ? 'Signed in' : 'This computer'}</span>
          </span>
          <ChevronDown size={16} className={cn('ec-sidebar-muted transition-transform max-2xl:hidden', menu && 'rotate-180')} />
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="ec-card ec-card-raised ec-pop-in absolute bottom-full left-3 z-20 mb-1 w-48 origin-bottom-left rounded-lg py-1 text-sm">
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
