import { cn } from '../../lib/cn';

/** An on/off switch whose knob glides across; keyboard and screen readers see a checkbox. */
export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm ring-1 ring-white/[0.05] ring-inset', className)}>
      <span className="text-slate-300">{label}</span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-400',
          checked ? 'bg-[linear-gradient(90deg,var(--accent-500),var(--accent-2))]' : 'bg-white/10',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </label>
  );
}
