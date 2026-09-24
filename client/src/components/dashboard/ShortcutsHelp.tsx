import { Modal } from '../ui/Modal';
import { Kbd } from '../ui/Kbd';

export const SHORTCUTS: [string, string][] = [
  ['→', 'Next queue item'],
  ['←', 'Previous queue item'],
  ['Space', 'Start / pause timer'],
  ['B', 'Black screen'],
  ['W', 'Waiting screen'],
  ['L', 'Show event logo'],
  ['S', 'Show current item'],
  ['F', 'Fullscreen the display'],
  ['PgDn / PgUp', 'Next / previous PDF page'],
  ['R', 'Reset timer'],
  ['?', 'Show this help'],
  ['Esc', 'Close dialogs / exit fullscreen'],
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <ul className="divide-y divide-white/[0.06]">
        {SHORTCUTS.map(([key, label]) => (
          <li key={key} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-300">{label}</span>
            <span className="flex gap-1">
              {key.split(' / ').map((k) => (
                <Kbd key={k} className="h-6 px-2 text-[11px]">
                  {k}
                </Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Shortcuts are disabled while typing in a field.</p>
    </Modal>
  );
}
