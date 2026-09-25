import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Hourglass, Maximize, MonitorPlay, Play, Square, Star } from 'lucide-react';
import { Kbd } from '../ui/Kbd';
import { cn } from '../../lib/cn';
import type { DisplaySnapshot } from '../../types';

interface QuickActionsProps {
  display: DisplaySnapshot | null;
  disabled?: boolean;
  onResume: () => void;
  onPleaseWait: () => void;
  onTechnical: () => void;
  onBlack: () => void;
  onLogo: () => void;
  onFullscreen: () => void;
  onOpenDisplay: () => void;
}

/**
 * Emergency controls: big, colour-coded, with the live state lit up. BLACK asks for a
 * second click (the B key acts immediately) so it can't be hit by accident.
 */
export function QuickActions({ display, disabled, onResume, onPleaseWait, onTechnical, onBlack, onLogo, onFullscreen, onOpenDisplay }: QuickActionsProps) {
  const [armed, setArmed] = useState(false);
  const disarm = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(disarm.current), []);

  const mode = display?.mode;
  const screenKey = mode === 'screen' ? display?.screen?.key : null;

  const black = () => {
    if (mode === 'black') return;
    if (!armed) {
      setArmed(true);
      disarm.current = window.setTimeout(() => setArmed(false), 3000);
      return;
    }
    window.clearTimeout(disarm.current);
    setArmed(false);
    onBlack();
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Action label="Resume" hint="Esc" icon={<Play size={20} />} active={mode === 'media'} disabled={disabled} onClick={onResume} tone="green" />
      <Action label="Please wait" hint="W" icon={<Hourglass size={20} />} active={screenKey === 'please-wait'} disabled={disabled} onClick={onPleaseWait} tone="yellow" />
      <Action label="Technical difficulty" hint="T" icon={<AlertTriangle size={20} />} active={screenKey === 'technical'} disabled={disabled} onClick={onTechnical} tone="orange" />
      <Action
        label={armed ? 'Click again to confirm' : 'Black screen'}
        hint="B"
        icon={<Square size={20} fill="currentColor" />}
        active={mode === 'black'}
        disabled={disabled}
        onClick={black}
        tone="red"
        armed={armed}
      />
      <button
        onClick={onLogo}
        disabled={disabled}
        aria-pressed={mode === 'logo'}
        className={cn(
          'flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-semibold tracking-wide uppercase disabled:opacity-40',
          mode === 'logo' ? 'border-violet-300 bg-violet-500 text-white' : 'border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20',
        )}
      >
        <Star size={14} /> Logo <Kbd className="border-current/30 bg-black/10 text-current">L</Kbd>
      </button>
      <button
        onClick={onFullscreen}
        disabled={disabled}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-console-800 text-xs font-semibold tracking-wide text-slate-200 uppercase hover:bg-console-700 disabled:opacity-40"
      >
        <Maximize size={14} /> Fullscreen <Kbd>F</Kbd>
      </button>
      <button
        onClick={onOpenDisplay}
        className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-console-800 text-sm font-medium text-slate-200 hover:bg-console-700"
      >
        <MonitorPlay size={16} /> Open display window
      </button>
    </div>
  );
}

// Idle: a tinted glass tile. Live: lit from within, like a key on a broadcast desk.
const tones = {
  green: {
    idle: 'border-emerald-500/25 bg-gradient-to-b from-emerald-500/15 to-emerald-500/[0.04] text-emerald-200 hover:border-emerald-400/45',
    on: 'border-emerald-200/70 bg-[linear-gradient(160deg,#4ade80,#059669)] text-emerald-950 shadow-[0_10px_28px_-10px_rgba(16,185,129,0.8),inset_0_1px_0_rgba(255,255,255,0.35)]',
  },
  yellow: {
    idle: 'border-yellow-400/25 bg-gradient-to-b from-yellow-400/15 to-yellow-400/[0.04] text-yellow-100 hover:border-yellow-300/45',
    on: 'border-yellow-100/70 bg-[linear-gradient(160deg,#fde047,#eab308)] text-yellow-950 shadow-[0_10px_28px_-10px_rgba(234,179,8,0.8),inset_0_1px_0_rgba(255,255,255,0.4)]',
  },
  orange: {
    idle: 'border-orange-500/25 bg-gradient-to-b from-orange-500/15 to-orange-500/[0.04] text-orange-200 hover:border-orange-400/45',
    on: 'border-orange-200/70 bg-[linear-gradient(160deg,#fb923c,#ea580c)] text-orange-950 shadow-[0_10px_28px_-10px_rgba(234,88,12,0.8),inset_0_1px_0_rgba(255,255,255,0.35)]',
  },
  red: {
    idle: 'border-red-500/30 bg-gradient-to-b from-red-600/20 to-red-600/[0.05] text-red-200 hover:border-red-400/50',
    on: 'border-red-300/70 bg-[linear-gradient(160deg,#f87171,#b91c1c)] text-white shadow-[0_10px_28px_-10px_rgba(220,38,38,0.85),inset_0_1px_0_rgba(255,255,255,0.3)]',
  },
};

function Action({
  label,
  hint,
  icon,
  active,
  disabled,
  onClick,
  tone,
  armed,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone: keyof typeof tones;
  armed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-[12px] leading-tight font-bold tracking-wide uppercase transition-[border-color,color,box-shadow,transform,translate] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-40',
        active ? tones[tone].on : tones[tone].idle,
        armed && 'ec-armed border-red-400 bg-red-600/40 text-white shadow-[0_0_0_3px_rgba(239,68,68,0.25)]',
      )}
    >
      {/* The icon pops when this mode goes live — a small confirmation you can see from the corner of your eye. */}
      <span key={active ? 'on' : 'off'} className={active ? 'ec-pop' : undefined}>
        {icon}
      </span>
      <span>{label}</span>
      {active && <span className="ec-dot-live absolute top-2.5 left-2.5 h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      <Kbd className="absolute top-1.5 right-1.5 border-current/30 bg-black/10 text-current opacity-70">{hint}</Kbd>
    </button>
  );
}
