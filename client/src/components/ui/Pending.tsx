import { cn } from '../../lib/cn';

/**
 * Loading that says what is happening ("Connecting to the event…") with a thin
 * indeterminate line under it — instead of an anonymous spinner.
 */
export function Pending({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2.5', className)} role="status" aria-live="polite">
      <p className="text-[var(--text-sm)] font-medium text-slate-400">{label}</p>
      <span className="ec-pending-line" aria-hidden />
    </div>
  );
}
