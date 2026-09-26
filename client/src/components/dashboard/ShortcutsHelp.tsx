import { Settings2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { KeyHint } from './StagePane';
import { SHORTCUT_DEFS } from '../../lib/shortcuts';
import { useShortcutBindings, useUiPrefs } from '../../lib/uiPrefs';

/** The "?" overview: the keys in effect on this computer, grouped like the settings. */
export function ShortcutsHelp({ open, onClose, onCustomize }: { open: boolean; onClose: () => void; onCustomize: () => void }) {
  const bindings = useShortcutBindings();
  const { prefs } = useUiPrefs();
  const groups = [...new Set(SHORTCUT_DEFS.map((d) => d.group))];
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      {!prefs.keyboard && <p className="mb-3 rounded-[4px] border border-amber-500/30 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-200">Keyboard shortcuts are turned off on this computer.</p>}
      <div className="grid gap-4">
        {groups.map((group) => (
          <section key={group}>
            <h3 className="ec-label mb-1">{group}</h3>
            <ul className="divide-y divide-[var(--line)]">
              {SHORTCUT_DEFS.filter((d) => d.group === group).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="text-slate-300">{d.label}</span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {bindings[d.id].length ? bindings[d.id].map((k) => <KeyHint key={k} combo={k} className="h-6 px-1.5 text-[11px]" />) : <span className="text-xs text-slate-600">none</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Ignored while typing in a field.</p>
        <Button size="sm" variant="secondary" icon={<Settings2 size={14} />} onClick={onCustomize}>
          Change keys…
        </Button>
      </div>
    </Modal>
  );
}
