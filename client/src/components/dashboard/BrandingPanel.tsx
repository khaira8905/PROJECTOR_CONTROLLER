import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { cn } from '../../lib/cn';
import type { EventSummary, Media, OverlayPosition } from '../../types';

interface Props {
  event: EventSummary | null;
  images: Media[];
  onChange: (patch: { mediaId?: string | null; position?: OverlayPosition; size?: number; opacity?: number; visible?: boolean }) => void;
}

const POSITIONS: { value: OverlayPosition; label: string; cls: string }[] = [
  { value: 'top-left', label: 'Top left', cls: 'col-start-1 row-start-1' },
  { value: 'top-right', label: 'Top right', cls: 'col-start-3 row-start-1' },
  { value: 'center', label: 'Center', cls: 'col-start-2 row-start-2' },
  { value: 'bottom-left', label: 'Bottom left', cls: 'col-start-1 row-start-3' },
  { value: 'bottom-right', label: 'Bottom right', cls: 'col-start-3 row-start-3' },
];

/** The logo drawn on top of slides and screens (university, event or sponsor logo). */
export function BrandingPanel({ event, images, onChange }: Props) {
  const overlay = event?.overlay;
  if (!overlay) return null;
  const selected = images.find((m) => m.id === overlay.mediaId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant={overlay.visible ? 'warning' : 'success'}
        icon={overlay.visible ? <EyeOff size={15} /> : <Eye size={15} />}
        disabled={!selected}
        onClick={() => onChange({ visible: !overlay.visible })}
      >
        {overlay.visible ? 'Hide logo overlay' : 'Show logo overlay'} <Kbd className="border-black/20 bg-black/10 text-current">O</Kbd>
      </Button>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-400">Logo</p>
        {images.length === 0 ? (
          <p className="rounded-lg bg-console-850 p-3 text-xs text-slate-500">Upload a logo image to the library (e.g. into the "Logos" folder).</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {images.map((m) => (
              <button
                key={m.id}
                onClick={() => onChange({ mediaId: m.id })}
                title={m.name}
                className={cn('aspect-square overflow-hidden rounded-md bg-black/40 p-1 ring-2', overlay.mediaId === m.id ? 'ring-sky-400' : 'ring-transparent hover:ring-white/20')}
              >
                <img src={m.url} alt={m.name} className="h-full w-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr] items-start gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-400">Position</p>
          <div className="grid h-[72px] w-[124px] grid-cols-3 grid-rows-3 gap-1 rounded-md bg-console-950 p-1 ring-1 ring-white/10">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                title={p.label}
                aria-label={p.label}
                onClick={() => onChange({ position: p.value })}
                className={cn('rounded-sm', p.cls, overlay.position === p.value ? 'bg-sky-400' : 'bg-white/10 hover:bg-white/25')}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Slider label="Size" value={overlay.size} min={3} max={40} suffix="%" onCommit={(v) => onChange({ size: v })} />
          <Slider label="Opacity" value={overlay.opacity} min={10} max={100} suffix="%" onCommit={(v) => onChange({ opacity: v })} />
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, suffix, onCommit }: { label: string; value: number; min: number; max: number; suffix: string; onCommit: (v: number) => void }) {
  return (
    <label className="text-xs text-slate-400">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-slate-300">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        defaultValue={value}
        key={value}
        // Commit on release, so dragging doesn't flood the display with updates.
        onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        className="mt-1 w-full accent-sky-400"
      />
    </label>
  );
}
