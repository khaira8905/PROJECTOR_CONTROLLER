import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Hourglass, Image as ImageIcon, Keyboard, MonitorOff, Play, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { Panel } from '../ui/Panel';
import { cn } from '../../lib/cn';
import type { DisplaySnapshot } from '../../types';

interface LiveControlsProps {
  display: DisplaySnapshot | null;
  disabled?: boolean;
  canNext: boolean;
  canPrevious: boolean;
  pageCount: number | null;
  jumpRef: React.RefObject<HTMLInputElement | null>;
  onResume: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onGoToPage: (page: number) => void;
  onShortcuts: () => void;
}

/** Resume, step through slides and jump to one: the controls used most during a show. */
export function LiveControls({ display, disabled, canNext, canPrevious, pageCount, jumpRef, onResume, onNext, onPrevious, onGoToPage, onShortcuts }: LiveControlsProps) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const showingFlow = display?.mode === 'media' && !display.adHocMediaId;

  const go = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (!pageCount || !Number.isInteger(n) || n < 1 || n > pageCount) {
      setInvalid(true);
      return;
    }
    onGoToPage(n);
    setValue('');
    setInvalid(false);
    jumpRef.current?.blur();
  };

  return (
    <Panel
      title="Live Controls"
      icon={<Zap size={20} />}
      actions={
        <Button size="sm" variant="secondary" icon={<Keyboard size={14} />} onClick={onShortcuts} className="text-xs">
          Keyboard Shortcuts
        </Button>
      }
      bodyClassName="flex flex-col gap-2"
    >
      <Button
        variant="primary"
        className="h-11 w-full justify-start gap-3 px-5 text-[15px]"
        icon={<Play size={17} fill="currentColor" />}
        onClick={onResume}
        disabled={disabled}
        title="Back to the current Show Flow item"
      >
        <span className="flex-1 text-left">{showingFlow ? 'Presentation is live' : 'Resume Presentation'}</span>
        <Kbd className="ec-kbd-on-solid">Esc</Kbd>
      </Button>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" className="h-10 justify-start gap-2.5 px-4" onClick={onPrevious} disabled={disabled || !canPrevious}>
          <ChevronLeft size={18} />
          <span className="flex-1 text-left">Previous</span>
          <Kbd>←</Kbd>
        </Button>
        <Button variant="secondary" className="h-10 justify-start gap-2.5 px-4" onClick={onNext} disabled={disabled || !canNext}>
          <ChevronRight size={18} />
          <span className="flex-1 text-left">Next</span>
          <Kbd>→</Kbd>
        </Button>
      </div>
      <form onSubmit={go} className="flex h-10 overflow-hidden rounded-lg border border-[var(--line-strong)]">
        <label htmlFor="ec-goto" className="flex shrink-0 items-center border-r border-[var(--line-strong)] bg-console-850 px-3.5 text-sm font-medium text-slate-300">
          Go to Slide
        </label>
        <input
          id="ec-goto"
          ref={jumpRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, ''));
            setInvalid(false);
          }}
          inputMode="numeric"
          placeholder={pageCount ? `1 – ${pageCount}` : 'Slide number'}
          disabled={!pageCount}
          aria-invalid={invalid}
          className={cn('min-w-0 flex-1 bg-console-900 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-60', invalid && 'text-red-300')}
        />
        <button type="submit" disabled={!pageCount} className="ec-btn-primary w-16 shrink-0 text-sm font-semibold disabled:opacity-50">
          Go
        </button>
      </form>
    </Panel>
  );
}

interface QuickScreensProps {
  display: DisplaySnapshot | null;
  disabled?: boolean;
  onPleaseWait: () => void;
  onTechnical: () => void;
  onBlack: () => void;
  onLogo: () => void;
}

/**
 * Emergency screens. Tinted when idle, solid when on the projector. Black needs a
 * second click (the B key acts at once) so it can't be hit by accident.
 */
export function QuickScreens({ display, disabled, onPleaseWait, onTechnical, onBlack, onLogo }: QuickScreensProps) {
  const [armed, setArmed] = useState(false);
  const disarm = useRef(0);
  useEffect(() => () => window.clearTimeout(disarm.current), []);
  const mode = display?.mode;
  const key = mode === 'screen' ? display?.screen?.key : null;

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
    <Panel title="Quick Screens" icon={<MonitorOff size={20} />} bodyClassName="grid grid-cols-2 gap-2">
      <QuickButton tone="amber" icon={<Hourglass size={20} />} label="Please Wait" hint="W" active={key === 'please-wait'} disabled={disabled} onClick={onPleaseWait} />
      <QuickButton tone="red" icon={<AlertTriangle size={20} />} label="Technical Difficulty" hint="T" active={key === 'technical'} disabled={disabled} onClick={onTechnical} />
      <QuickButton
        tone="neutral"
        icon={<MonitorOff size={20} />}
        label={armed ? 'Click again' : 'Black Screen'}
        hint="B"
        active={mode === 'black'}
        armed={armed}
        disabled={disabled}
        onClick={black}
      />
      <QuickButton tone="neutral" icon={<ImageIcon size={20} />} label="Show Logo" hint="L" active={mode === 'logo'} disabled={disabled} onClick={onLogo} />
    </Panel>
  );
}

// Idle colours come from the theme (styles/console.css); when live the button is solid.
const quickTones = {
  amber: { idle: 'ec-quick-idle', on: 'border-amber-500 bg-[#f59e0b] text-[#1f1300]' },
  red: { idle: 'ec-quick-idle', on: 'border-red-600 bg-[#dc2626] text-[#fff]' },
  neutral: { idle: 'border-[var(--line-strong)] bg-console-700 text-slate-200 hover:bg-console-600', on: 'border-[#111827] bg-[#111827] text-[#fff]' },
};

function QuickButton({
  tone,
  icon,
  label,
  hint,
  active,
  armed,
  disabled,
  onClick,
}: {
  tone: keyof typeof quickTones;
  icon: ReactNode;
  label: string;
  hint: string;
  active: boolean;
  armed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'ec-quick group relative flex h-12 items-center gap-2.5 rounded-lg border px-3 text-left text-[14px] font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:opacity-45',
        `ec-quick-${tone}`,
        active ? quickTones[tone].on : quickTones[tone].idle,
        armed && 'ec-armed border-red-500 bg-red-600 text-[#fff]',
      )}
    >
      <span key={active ? 'on' : 'off'} className={cn('shrink-0', active && 'ec-pop')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
      {active ? (
        <span className="ec-dot-live h-2 w-2 shrink-0 rounded-full bg-current" aria-label="On the projector" />
      ) : (
        <Kbd className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">{hint}</Kbd>
      )}
    </button>
  );
}
