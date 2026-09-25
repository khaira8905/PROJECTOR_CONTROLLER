import { MonitorPlay } from 'lucide-react';

export function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500">
        <MonitorPlay size={17} className="text-[#fff]" />
      </span>
      {!compact && (
        <span className="font-display text-[16px] font-bold tracking-tight text-white">
          Event<span className="text-sky-400">Control</span>
        </span>
      )}
    </span>
  );
}
