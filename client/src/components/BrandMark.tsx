import { MonitorPlay } from 'lucide-react';

export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 shadow-lg shadow-sky-500/20">
        <MonitorPlay size={17} className="text-white" />
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-white">
          Event<span className="text-sky-400">Control</span>
        </span>
      )}
    </span>
  );
}
