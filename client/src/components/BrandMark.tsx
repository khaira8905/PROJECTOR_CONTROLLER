import { MonitorPlay } from 'lucide-react';

export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="ec-shimmer relative flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(120deg,#0ea5e9,#7c3aed,#0ea5e9)] shadow-lg shadow-sky-500/20">
        <MonitorPlay size={17} className="text-white" />
      </span>
      {!compact && (
        <span className="font-display text-[16px] font-bold tracking-tight text-white">
          Event<span className="text-sky-400">Control</span>
        </span>
      )}
    </span>
  );
}
