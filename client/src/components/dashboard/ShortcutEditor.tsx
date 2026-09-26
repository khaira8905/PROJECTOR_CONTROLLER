import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, RotateCcw, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { cn } from '../../lib/cn';
import {
  SHORTCUT_BY_ID,
  SHORTCUT_DEFS,
  comboFromEvent,
  comboParts,
  findConflicts,
  ownerOf,
  prettyCombo,
  reservedReason,
  withBinding,
  type ShortcutAction,
  type ShortcutOverrides,
} from '../../lib/shortcuts';

interface Props {
  bindings: Record<ShortcutAction, string[]>;
  overrides: ShortcutOverrides;
  onChange: (overrides: ShortcutOverrides) => void;
}

/** Recording a key for an action: add a new key, or replace one of its keys. */
interface Recording {
  action: ShortcutAction;
  replace: string | null;
}

/** A key that is taken, waiting for the operator to decide. Nothing changes until they do. */
interface PendingConflict {
  action: ShortcutAction;
  replace: string | null;
  combo: string;
  owner: ShortcutAction;
}

/**
 * The shortcut list, editable in place. Click a key to replace it, "+" to add one,
 * × to remove it. A key that is already taken is never silently moved: the row asks.
 */
export function ShortcutEditor({ bindings, overrides, onChange }: Props) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [conflict, setConflict] = useState<PendingConflict | null>(null);
  const [notice, setNotice] = useState<{ action: ShortcutAction; text: string } | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const conflicts = useMemo(() => findConflicts(bindings), [bindings]);
  const groups = [...new Set(SHORTCUT_DEFS.map((d) => d.group))];
  const customised = Object.keys(overrides).length;

  useEffect(() => {
    if (!resetArmed) return;
    const t = window.setTimeout(() => setResetArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [resetArmed]);

  const assign = (action: ShortcutAction, replace: string | null, combo: string, from?: ShortcutAction) => {
    let next = overrides;
    if (from) next = withBinding(next, from, bindings[from].filter((k) => k !== combo));
    const current = bindings[action].filter((k) => k !== combo);
    const keys = replace ? current.map((k) => (k === replace ? combo : k)) : [...current, combo];
    next = withBinding(next, action, replace && !current.includes(replace) ? [...current, combo] : keys);
    onChange(next);
  };

  const onRecorded = (combo: string) => {
    if (!recording) return;
    const { action, replace } = recording;
    setRecording(null);
    const reserved = reservedReason(combo);
    if (reserved) return setNotice({ action, text: `${prettyCombo(combo)} can’t be used: ${reserved}` });
    if (bindings[action].includes(combo) && combo !== replace) return setNotice({ action, text: `${prettyCombo(combo)} is already one of its keys.` });
    const owner = ownerOf(bindings, combo, action);
    if (owner) return setConflict({ action, replace, combo, owner });
    setNotice(null);
    assign(action, replace, combo);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="mr-auto text-[13px] text-slate-500">
          Click a key to change it. {customised ? `${customised} ${customised === 1 ? 'action uses' : 'actions use'} your own keys.` : 'All keys are the defaults.'}
        </p>
        <Button
          size="sm"
          variant={resetArmed ? 'danger' : 'ghost'}
          icon={<RotateCcw size={13} />}
          disabled={!customised}
          onClick={() => {
            if (!resetArmed) return setResetArmed(true);
            setResetArmed(false);
            setConflict(null);
            onChange({});
          }}
        >
          {resetArmed ? 'Click again to reset all' : 'Reset all to defaults'}
        </Button>
      </div>

      {conflicts.size > 0 && (
        <p className="mb-3 flex items-start gap-2 rounded-[4px] border border-red-500/35 bg-red-500/10 px-3 py-2 text-[13px] text-red-300" role="alert">
          <AlertTriangle size={15} className="mt-px shrink-0" />
          {[...conflicts].map(([k, actions]) => `${prettyCombo(k)} is used by ${actions.map((a) => SHORTCUT_BY_ID[a].label).join(' and ')}`).join('. ')}. Only the first one will react — pick another key for one of them.
        </p>
      )}

      <div className="grid gap-5">
        {groups.map((group) => (
          <section key={group}>
            <h4 className="ec-label mb-1">{group}</h4>
            <ul className="ec-settings-list">
              {SHORTCUT_DEFS.filter((d) => d.group === group).map((def) => {
                const keys = bindings[def.id];
                const custom = !!overrides[def.id];
                const rowConflict = conflict?.action === def.id ? conflict : null;
                const clashes = keys.filter((k) => conflicts.has(k));
                return (
                  <li key={def.id} className="ec-settings-row grid gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-conflict={clashes.length > 0 || undefined}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200">{def.label}</p>
                      {def.hint && <p className="text-[12px] leading-snug text-slate-500">{def.hint}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      {keys.map((k) =>
                        recording?.action === def.id && recording.replace === k ? (
                          <Recorder key={k} onKey={onRecorded} onCancel={() => setRecording(null)} />
                        ) : (
                          <KeyChip
                            key={k}
                            combo={k}
                            clash={conflicts.has(k)}
                            onEdit={() => {
                              setConflict(null);
                              setNotice(null);
                              setRecording({ action: def.id, replace: k });
                            }}
                            onRemove={() => onChange(withBinding(overrides, def.id, keys.filter((x) => x !== k)))}
                          />
                        ),
                      )}
                      {recording?.action === def.id && recording.replace === null ? (
                        <Recorder onKey={onRecorded} onCancel={() => setRecording(null)} />
                      ) : (
                        <button
                          onClick={() => {
                            setConflict(null);
                            setNotice(null);
                            setRecording({ action: def.id, replace: null });
                          }}
                          className="ec-icon-btn flex h-7 w-7 items-center justify-center rounded-[4px] border border-dashed border-[var(--line-strong)] text-slate-500 hover:border-sky-400 hover:text-sky-300"
                          aria-label={`Add a key for ${def.label}`}
                          title="Add a key"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => onChange(withBinding(overrides, def.id, SHORTCUT_BY_ID[def.id].keys))}
                        className={cn('ec-icon-btn flex h-7 w-7 items-center justify-center rounded-[4px] text-slate-500 hover:bg-console-700 hover:text-white', !custom && 'invisible')}
                        aria-label={`Reset ${def.label} to ${def.keys.map(prettyCombo).join(', ')}`}
                        title={`Reset to ${def.keys.map(prettyCombo).join(', ') || 'no key'}`}
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>

                    {rowConflict && (
                      <div className="ec-rise-in flex flex-wrap items-center gap-2 rounded-[4px] border border-amber-500/35 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-200 sm:col-span-2" role="alert">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span className="mr-auto">
                          <b>{prettyCombo(rowConflict.combo)}</b> is already used by <b>{SHORTCUT_BY_ID[rowConflict.owner].label}</b>.
                        </span>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            assign(rowConflict.action, rowConflict.replace, rowConflict.combo, rowConflict.owner);
                            setConflict(null);
                          }}
                        >
                          Use it here instead
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConflict(null)}>
                          Keep it there
                        </Button>
                      </div>
                    )}
                    {notice?.action === def.id && (
                      <p className="ec-rise-in text-[13px] text-amber-300 sm:col-span-2" role="status">
                        {notice.text}
                      </p>
                    )}
                    {!keys.length && !rowConflict && <p className="text-[12px] text-slate-500 sm:col-span-2 sm:text-right">No key — use the button on screen.</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function KeyChip({ combo, clash, onEdit, onRemove }: { combo: string; clash: boolean; onEdit: () => void; onRemove: () => void }) {
  return (
    <span className={cn('ec-keychip group inline-flex items-center rounded-[4px] border', clash ? 'border-red-500/60 bg-red-500/10' : 'border-[var(--line-strong)] bg-console-850')}>
      <button onClick={onEdit} className="flex items-center gap-0.5 py-1 pr-1 pl-1.5" title="Click, then press the new key" aria-label={`Change ${prettyCombo(combo)}`}>
        {comboParts(combo).map((p) => (
          <Kbd key={p} className="h-5 border-0 bg-transparent px-1 text-[11px] text-slate-100">
            {p}
          </Kbd>
        ))}
      </button>
      <button onClick={onRemove} className="flex h-full items-center border-l border-[var(--line)] px-1 text-slate-500 opacity-60 transition-opacity group-hover:opacity-100 hover:text-red-400" aria-label={`Remove ${prettyCombo(combo)}`} title="Remove this key">
        <X size={12} />
      </button>
    </span>
  );
}

/** "Press a key…": takes the next key press (Esc cancels). Global shortcuts ignore it meanwhile. */
function Recorder({ onKey, onCancel }: { onKey: (combo: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <button
      ref={ref}
      data-capture-keys
      onKeyDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') return onCancel();
        const combo = comboFromEvent(e.nativeEvent);
        if (combo) onKey(combo);
      }}
      onBlur={onCancel}
      className="ec-recording inline-flex h-7 items-center gap-2 rounded-[4px] border border-sky-400 bg-sky-500/10 px-2.5 text-[12px] font-medium text-sky-200"
    >
      <span className="ec-rec-dot h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden />
      Press a key… <span className="text-sky-300/60">Esc cancels</span>
    </button>
  );
}
