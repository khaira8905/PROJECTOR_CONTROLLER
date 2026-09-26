import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { DisplayStage, type VideoCommand } from '../components/display/DisplayStage';
import { useEventSocket } from '../hooks/useEventSocket';
import { ClockOffsetContext } from '../hooks/useLiveRemaining';

/**
 * The audience-facing projector output. No navigation, no operator controls:
 * it only renders what the server says it should show.
 */
export default function DisplayPage() {
  const { eventId } = useParams();
  const [videoCommand, setVideoCommand] = useState<VideoCommand | null>(null);
  const [activated, setActivated] = useState(false);
  // The setup hint is for whoever opens the window; it leaves the audience's screen on its own.
  const [hintGone, setHintGone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHintGone(true), 8000);
    return () => window.clearTimeout(t);
  }, []);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const nonce = useRef(0);

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      return true;
    } catch {
      return false;
    }
  }, []);

  const { connected, joined, joinError, display, timer, clockOffset, emitRaw } = useEventSocket(eventId, 'display', {
    onVideo: (action) => setVideoCommand({ action, nonce: ++nonce.current }),
    onFullscreenRequest: async () => {
      const ok = await requestFullscreen();
      emitRaw('display:fullscreen-result', { ok });
    },
    onEventDeleted: () => window.location.reload(),
  });

  // The first click/keypress enables fullscreen and audio (browsers require a user gesture).
  useEffect(() => {
    const activate = () => {
      setActivated(true);
      void requestFullscreen();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else activate();
      } else if (!activated) setActivated(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', activate);
    const hideHint = window.setTimeout(() => setActivated(true), 12_000);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', activate);
      window.clearTimeout(hideHint);
    };
  }, [activated, requestFullscreen]);

  // Keep the projector laptop awake: no screen saver or sleep in the middle of a talk.
  // Browsers drop the lock when the tab is hidden, so take it again when it comes back.
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    let disposed = false;
    const acquire = () => {
      if (document.hidden || disposed) return;
      nav.wakeLock!.request('screen').then(
        (l) => (disposed ? void l.release() : (lock = l)),
        () => undefined, // not allowed (e.g. battery saver): the display still works
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Hide the mouse cursor when idle so it never floats over the projected content.
  useEffect(() => {
    let timeout = window.setTimeout(() => setCursorHidden(true), 2000);
    const onMove = () => {
      setCursorHidden(false);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setCursorHidden(true), 2000);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.clearTimeout(timeout);
    };
  }, []);

  // Only flag a lost connection if it lasts; brief blips are invisible to the audience.
  useEffect(() => {
    if (connected && joined) {
      setShowOffline(false);
      return;
    }
    const t = window.setTimeout(() => setShowOffline(true), 3000);
    return () => window.clearTimeout(t);
  }, [connected, joined]);

  useEffect(() => {
    document.title = display ? `Display · ${display.eventName}` : 'EventControl Display';
  }, [display?.eventName]);

  return (
    <div className="fixed inset-0 bg-black select-none" style={{ cursor: cursorHidden ? 'none' : 'default', '--color-white': '#fff', colorScheme: 'dark' } as CSSProperties}>
      {/* The last known state stays on screen while reconnecting: the display never blanks on a network blip. */}
      {display ? (
        <ClockOffsetContext.Provider value={clockOffset}>
          <DisplayStage display={display} timer={timer} variant="display" videoCommand={videoCommand} />
        </ClockOffsetContext.Provider>
      ) : joinError ? (
        <div className="flex h-full items-center justify-center text-center text-lg text-slate-500">
          <div>
            <p className="font-semibold text-slate-300">Display unavailable</p>
            <p className="mt-2 text-sm">{joinError}</p>
          </div>
        </div>
      ) : null}

      {!activated && !hintGone && display && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="ec-fade-up rounded-full bg-white/10 px-4 py-2 text-sm text-white/70 backdrop-blur" style={{ animationDelay: '1.2s' }}>
            Click anywhere or press <b>F</b> for fullscreen
          </div>
        </div>
      )}

      {showOffline && (
        <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/50">
          <span className="animate-pulse-soft h-2 w-2 rounded-full bg-red-500" />
          Reconnecting…
        </div>
      )}
    </div>
  );
}
