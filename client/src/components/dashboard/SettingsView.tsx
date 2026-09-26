import { useRef, type ReactNode } from 'react';
import { ExternalLink, HardDriveUpload, Keyboard, Loader2, LogOut, Maximize, MonitorPlay, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { Segmented } from '../ui/Segmented';
import { ThemePicker } from '../ThemeSwitcher';
import { DriveIcon } from '../DriveIcon';
import { resolveQuickItems } from './QuickSelection';
import { ACCEPTED_FILE_TYPES, api } from '../../services/api';
import { useUiPrefs } from '../../lib/uiPrefs';
import { cn } from '../../lib/cn';
import type { EventPreferences, EventSummary, GoogleStatus, Media, Screen } from '../../types';

const SECTIONS = [
  ['presentation', 'Presentation'],
  ['quick', 'Quick Selection'],
  ['interface', 'Interface'],
  ['files', 'File sources'],
  ['projector', 'Projector'],
  ['account', 'Event & account'],
] as const;

interface SettingsViewProps {
  event: EventSummary | null;
  media: Media[];
  screens: Screen[];
  google: GoogleStatus | null;
  signedIn: boolean;
  displayUrl: string;
  uploadProgress: number | null;
  onPreferences: (patch: Partial<EventPreferences>) => void;
  onCustomizeQuick: () => void;
  onUpload: (files: File[]) => void;
  onBrowseDrive: () => void;
  onDisconnectGoogle: () => Promise<void>;
  onEditEvent: () => void;
  onOpenDisplay: () => void;
  onFullscreen: () => void;
  onShortcuts: () => void;
  onSignOut: () => void;
  onCopied: () => void;
}

/** Everything that is set once and then left alone, grouped the way a presenter thinks about it. */
export function SettingsView(props: SettingsViewProps) {
  const { event, media, screens, google } = props;
  const prefs = event?.preferences;
  const { prefs: ui, set: setUi } = useUiPrefs();
  const input = useRef<HTMLInputElement>(null);
  const decks = media.filter((m) => (m.kind === 'presentation' || m.kind === 'pdf') && !m.missing);
  const defaultDeck = decks.find((m) => m.id === prefs?.defaultMediaId) ?? null;
  const quick = prefs ? resolveQuickItems(prefs.quickSelection, screens, media, null) : [];
  const returnHere = `${window.location.pathname}?view=settings`;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[180px_minmax(0,1fr)]">
      <nav className="max-lg:hidden" aria-label="Settings sections">
        <ul className="sticky top-2 grid gap-0.5 pt-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#settings-${id}`} className="block rounded-[5px] px-3 py-1.5 text-slate-400 hover:bg-console-700 hover:text-white">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 divide-y divide-[var(--line)]">
        <Section id="presentation" title="Presentation" note="Saved with this event, for every console.">
          <Row label="Default presentation" hint="What “Start” shows when nothing from the Flow is on screen yet. Leave empty to start with the first Flow item.">
            <select
              value={prefs?.defaultMediaId ?? ''}
              onChange={(e) => props.onPreferences({ defaultMediaId: e.target.value || null })}
              className="h-10 w-full max-w-sm rounded-md border border-[var(--line-strong)] bg-console-900 px-3 text-sm text-white focus:border-sky-400 focus:outline-none"
            >
              <option value="">First item in the Flow</option>
              {decks.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Start at slide" hint={defaultDeck?.pageCount ? `1 to ${defaultDeck.pageCount}` : 'Used with the default presentation.'}>
            <input
              type="number"
              min={1}
              max={defaultDeck?.pageCount ?? 9999}
              disabled={!defaultDeck}
              value={prefs?.defaultStartPage ?? ''}
              placeholder="1"
              onChange={(e) => {
                const n = Number(e.target.value);
                props.onPreferences({ defaultStartPage: e.target.value === '' ? null : Math.max(1, Math.min(defaultDeck?.pageCount ?? 9999, Math.round(n) || 1)) });
              }}
              className="h-10 w-28 rounded-md border border-[var(--line-strong)] bg-console-900 px-3 text-sm text-white tabular-nums focus:border-sky-400 focus:outline-none disabled:opacity-50"
            />
          </Row>
          <Row label="Black screen needs two clicks" hint="Prevents going black by accident. The B key always acts at once.">
            <Switch compact hideLabel label="Black screen needs two clicks" checked={prefs?.confirmBlack ?? true} onChange={(v) => props.onPreferences({ confirmBlack: v })} />
          </Row>
        </Section>

        <Section id="quick" title="Quick Selection" note="The shortcut buttons under the picture in the Control view.">
          <div className="flex flex-wrap items-center gap-2">
            {quick.map((q) => (
              <span key={q.item.id} className="inline-flex items-center gap-2 rounded-[4px] border border-[var(--line-strong)] px-2.5 py-1.5 text-sm text-slate-200">
                <span className="text-slate-400">{q.icon}</span>
                {q.label}
              </span>
            ))}
            {quick.length === 0 && <span className="text-sm text-slate-500">No shortcuts yet.</span>}
          </div>
          <Button className="mt-4" icon={<Pencil size={14} />} onClick={props.onCustomizeQuick}>
            Add, remove and reorder…
          </Button>
        </Section>

        <Section id="interface" title="Interface" note="How this console looks on this computer only.">
          <Row label="Theme">
            <ThemePicker />
          </Row>
          <Row label="Density" hint="Compact fits more Flow items on small screens.">
            <Segmented
              value={ui.density}
              onChange={(v) => setUi({ density: v })}
              className="w-fit rounded-md border border-[var(--line)] p-0.5 [&_button]:px-3 [&_button]:py-1 [&_button]:text-[13px] [&_button]:font-medium [&_button]:tracking-normal [&_button]:normal-case"
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </Row>
          <Row label="Animations" hint="Only the console. The projector keeps its own transitions.">
            <Segmented
              value={ui.motion}
              onChange={(v) => setUi({ motion: v })}
              className="w-fit rounded-md border border-[var(--line)] p-0.5 [&_button]:px-3 [&_button]:py-1 [&_button]:text-[13px] [&_button]:font-medium [&_button]:tracking-normal [&_button]:normal-case"
              options={[
                { value: 'full', label: 'Full' },
                { value: 'reduced', label: 'Reduced' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </Row>
          <Row label="Projector picture" hint="The live picture of what the audience sees.">
            <Switch compact hideLabel label="Projector picture" checked={ui.showPreview} onChange={(v) => setUi({ showPreview: v })} />
          </Row>
          <Row label="Slide thumbnails in the Flow" hint="The item on screen opens up to show its slides.">
            <Switch compact hideLabel label="Slide thumbnails in the Flow" checked={ui.showSlides} onChange={(v) => setUi({ showSlides: v })} />
          </Row>
          <Row label="Presenter mode" hint="Only the Flow, the picture and the buttons: no menus. Turn off from the top bar.">
            <Switch compact hideLabel label="Presenter mode" checked={ui.presenterMode} onChange={(v) => setUi({ presenterMode: v })} />
          </Row>
        </Section>

        <Section id="files" title="File sources" note="Where presentations come from. Everything is copied onto this computer so it works without internet.">
          <SourceRow icon={<HardDriveUpload size={20} className="text-slate-300" />} title="This computer" detail={`PowerPoint, PDF, images and videos. ${media.length} ${media.length === 1 ? 'file' : 'files'} in this event.`}>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length) props.onUpload(files);
              }}
            />
            <Button onClick={() => input.current?.click()} disabled={props.uploadProgress !== null}>
              {props.uploadProgress !== null ? `Uploading ${Math.round(props.uploadProgress * 100)}%` : 'Upload files…'}
            </Button>
          </SourceRow>
          <SourceRow
            icon={<DriveIcon size={20} />}
            title="Google Drive"
            detail={
              !google
                ? 'Checking…'
                : !google.configured
                  ? 'Not set up on this server yet: add a Google OAuth client to the .env file (README → Google Drive).'
                  : google.connected
                    ? `Connected as ${google.account?.email}${google.drive ? '' : ' — without Drive access'}.`
                    : 'Import PowerPoint, Google Slides and PDF files from your Drive.'
            }
          >
            {!google ? (
              <Loader2 size={16} className="animate-spin text-slate-500" />
            ) : !google.configured ? (
              <a href="https://github.com/khaira8905/PROJECTOR_CONTROLLER#google-drive" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 hover:underline">
                How to set up <ExternalLink size={13} />
              </a>
            ) : google.connected && google.drive ? (
              <div className="flex gap-2">
                <Button variant="primary" onClick={props.onBrowseDrive}>
                  Browse Drive
                </Button>
                <Button variant="ghost" onClick={() => void props.onDisconnectGoogle()}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <a href={api.googleConnectUrl(returnHere)} className="ec-btn ec-btn-primary inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold">
                Connect
              </a>
            )}
          </SourceRow>
        </Section>

        <Section id="projector" title="Projector">
          <p className="text-sm text-slate-400">
            Open the display on the computer connected to the projector (or drag the window onto the projector screen), then press <b className="text-slate-200">F</b> in it for fullscreen.
          </p>
          <div className="mt-3 flex max-w-xl overflow-hidden rounded-md border border-[var(--line-strong)]">
            <input readOnly value={props.displayUrl} className="min-w-0 flex-1 bg-console-850 px-3 py-2 font-mono text-[13px] text-slate-300 focus:outline-none" onFocus={(e) => e.target.select()} aria-label="Display link" />
            <button className="border-l border-[var(--line-strong)] px-3 text-sm font-medium text-slate-200 hover:bg-console-700" onClick={() => void navigator.clipboard?.writeText(props.displayUrl).then(props.onCopied, () => undefined)}>
              Copy link
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" icon={<MonitorPlay size={16} />} onClick={props.onOpenDisplay}>
              Open display window
            </Button>
            <Button icon={<Maximize size={15} />} onClick={props.onFullscreen}>
              Make it fullscreen
            </Button>
          </div>
        </Section>

        <Section id="account" title="Event & account">
          <Row label={event?.name ?? 'Event'} hint={[event?.venue, event?.date].filter(Boolean).join(' · ') || 'No date or venue yet.'}>
            <Button icon={<Pencil size={14} />} onClick={props.onEditEvent}>
              Edit details
            </Button>
          </Row>
          <Row label="Keyboard shortcuts" hint="→ / Space next, ← previous, B black, W please wait, Esc back to the Flow.">
            <Button icon={<Keyboard size={15} />} onClick={props.onShortcuts}>
              Show all
            </Button>
          </Row>
          {props.signedIn && (
            <Row label="Operator session" hint={google?.signInEnabled ? 'You can also sign in with an allowed Google account.' : 'Signed in with the operator password.'}>
              <Button icon={<LogOut size={15} />} onClick={props.onSignOut}>
                Sign out
              </Button>
            </Row>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={`settings-${id}`} className="scroll-mt-24 py-7 first:pt-1">
      <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-white">{title}</h2>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-center sm:gap-6">
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SourceRow({ icon, title, detail, children }: { icon: ReactNode; title: string; detail: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4 border-b ec-line py-4 last:border-b-0')}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-console-850">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-[13px] text-slate-500">{detail}</p>
      </div>
      {children}
    </div>
  );
}
