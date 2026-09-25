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

const tones = {
  green: { idle: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20', on: 'border-emerald-300 bg-emerald-500 text-emerald-950' },
  yellow: { idle: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-100 hover:bg-yellow-400/20', on: 'border-yellow-200 bg-yellow-400 text-yellow-950' },
  orange: { idle: 'border-orange-500/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20', on: 'border-orange-300 bg-orange-500 text-orange-950' },
  red: { idle: 'border-red-500/40 bg-red-600/15 text-red-200 hover:bg-red-600/25', on: 'border-red-400 bg-red-600 text-white shadow-lg shadow-red-900/40' },
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
        'relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-[12px] leading-tight font-bold tracking-wide uppercase transition-colors disabled:opacity-40',
        active ? tones[tone].on : tones[tone].idle,
        armed && 'animate-pulse-soft border-red-400 bg-red-600/40 text-white',
      )}
    >
      {icon}
      <span>{label}</span>
      <Kbd className="absolute top-1.5 right-1.5 border-current/30 bg-black/10 text-current opacity-70">{hint}</Kbd>
    </button>
  );
}
