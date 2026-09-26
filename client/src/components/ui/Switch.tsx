import { cn } from '../../lib/cn';

/** An on/off switch whose knob glides across; keyboard and screen readers see a checkbox. */
export function Switch({ checked, onChange, label, className, compact, hideLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string; compact?: boolean; hideLabel?: boolean }) {
  return (
    <label
      className={cn(
        'flex shrink-0 cursor-pointer items-center justify-between gap-2.5 text-sm',
        !compact && 'rounded-lg border border-[var(--line)] bg-console-850 px-3 py-2.5',
        className,
      )}
    >
      <span className={hideLabel ? 'sr-only' : compact ? 'text-[13px] text-slate-400' : 'text-slate-300'}>{label}</span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-[3px] transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-400',
          checked ? 'bg-sky-500' : 'bg-console-500',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-[2px] bg-[#fff] shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </label>
  );
}
