import { Clapperboard, Hourglass, Maximize, MonitorPlay, Square, Star } from 'lucide-react';
import { Kbd } from '../ui/Kbd';
import { cn } from '../../lib/cn';
import type { DisplayMode } from '../../types';

interface DisplayControlsProps {
  mode: DisplayMode | null;
  disabled?: boolean;
  onShowCurrent: () => void;
  onBlack: () => void;
  onWaiting: () => void;
  onLogo: () => void;
  onFullscreen: () => void;
  onOpenDisplay: () => void;
}

/**
 * Emergency/display controls. Big targets, distinct colours, and the active mode
 * is clearly lit so the operator can read the projector state at a glance.
 */
export function DisplayControls({ mode, disabled, onShowCurrent, onBlack, onWaiting, onLogo, onFullscreen, onOpenDisplay }: DisplayControlsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <ControlButton
        label="Black screen"
        shortcut="B"
        icon={<Square size={20} fill="currentColor" />}
        active={mode === 'black'}
        disabled={disabled}
        onClick={onBlack}
        className="border-red-500/40 bg-red-600/15 text-red-200 hover:bg-red-600/25"
        activeClass="bg-red-600 text-white border-red-400 shadow-lg shadow-red-900/40"
      />
      <ControlButton
        label="Waiting screen"
        shortcut="W"
        icon={<Hourglass size={20} />}
        active={mode === 'waiting'}
        disabled={disabled}
        onClick={onWaiting}
        className="border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
        activeClass="bg-sky-500 text-slate-950 border-sky-300"
      />
      <ControlButton
        label="Show logo"
        shortcut="L"
        icon={<Star size={20} />}
        active={mode === 'logo'}
        disabled={disabled}
        onClick={onLogo}
        className="border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
        activeClass="bg-violet-500 text-white border-violet-300"
      />
      <ControlButton
        label="Show current"
        shortcut="S"
        icon={<Clapperboard size={20} />}
        active={mode === 'media'}
        disabled={disabled}
        onClick={onShowCurrent}
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
        activeClass="bg-emerald-500 text-emerald-950 border-emerald-300"
      />
      <button
        onClick={onOpenDisplay}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-console-800 text-sm font-medium text-slate-200 hover:bg-console-700 sm:col-span-2"
      >
        <MonitorPlay size={16} /> Open display window
      </button>
      <button
        onClick={onFullscreen}
        disabled={disabled}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-console-800 text-sm font-medium text-slate-200 hover:bg-console-700 disabled:opacity-40 sm:col-span-2"
      >
        <Maximize size={16} /> Fullscreen display <Kbd>F</Kbd>
      </button>
    </div>
  );
}

function ControlButton({
  label,
  shortcut,
  icon,
  active,
  disabled,
  onClick,
  className,
  activeClass,
}: {
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  className: string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-bold tracking-wide uppercase transition-colors disabled:opacity-40',
        active ? activeClass : className,
      )}
    >
      {icon}
      <span className="text-[12px]">{label}</span>
      <Kbd className="absolute top-1.5 right-1.5 border-current/30 bg-black/10 text-current opacity-70">{shortcut}</Kbd>
    </button>
  );
}
