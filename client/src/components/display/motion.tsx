import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { formatClock } from '../../lib/format';

export type LayerKind = 'media' | 'screen' | 'black' | 'logo';

const ENTER_MS: Record<LayerKind, number> = { media: 700, screen: 650, logo: 650, black: 480 };
const ENTER_CLASS: Record<LayerKind, string> = {
  media: 'ec-layer-in-media',
  screen: 'ec-layer-in',
  logo: 'ec-layer-in',
  black: 'ec-layer-in-black-soft',
};

interface Layer {
  key: string;
  kind: LayerKind;
}

/**
 * Cross-fades whatever is on the display. The new content enters on top of the old
 * one (which stays fully visible underneath), so there is never a dip to black
 * between items — except when going to black, which is a quick 120 ms fade.
 * Old layers keep their component instances until they are removed, so videos and
 * slides don't flash or restart while fading out.
 */
export function StageTransition({ layerKey, kind, cutBlack = false, children }: { layerKey: string; kind: LayerKind; cutBlack?: boolean; children: ReactNode }) {
  const [layers, setLayers] = useState<Layer[]>([{ key: layerKey, kind }]);
  const nodes = useRef(new Map<string, ReactNode>());
  nodes.current.set(layerKey, children);

  const current = layers[layers.length - 1];
  if (current.key !== layerKey) {
    // Derived state: the previous layer stays mounted underneath while the new one enters.
    setLayers((prev) => [...prev.filter((l) => l.key !== layerKey), { key: layerKey, kind }]);
  }

  // "Fade to black" off: going to and coming back from black is an instant cut.
  const previousKind = layers.length > 1 ? layers[layers.length - 2].kind : null;
  const cut = cutBlack && (current.kind === 'black' || previousKind === 'black');

  useEffect(() => {
    if (layers.length <= 1) return;
    const timeout = window.setTimeout(() => {
      setLayers((prev) => {
        const keep = prev.slice(-1);
        for (const l of prev.slice(0, -1)) if (l.key !== keep[0].key) nodes.current.delete(l.key);
        return keep;
      });
    }, cut ? 0 : ENTER_MS[kind] + 80);
    return () => window.clearTimeout(timeout);
  }, [layerKey, layers.length, kind, cut]);

  return (
    <div className="absolute inset-0">
      {layers.map((layer, i) => {
        const live = i === layers.length - 1;
        return (
          <div
            key={layer.key}
            aria-hidden={!live}
            className={cn('absolute inset-0 overflow-hidden bg-black', live ? !cut && ENTER_CLASS[layer.kind] : 'pointer-events-none')}
          >
            {live ? children : nodes.current.get(layer.key)}
          </div>
        );
      })}
    </div>
  );
}

/** Keeps something mounted for `exitMs` after it is hidden, so it can animate out. */
export function usePresence(visible: boolean, exitMs = 400) {
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [visible, exitMs]);
  return { mounted: visible || mounted, leaving: !visible && mounted };
}

/** A headline whose words rise out of a mask one after another. */
export function RevealText({
  text,
  as: Tag = 'h1',
  className,
  style,
  delay = 0,
  stagger = 75,
}: {
  text: string;
  as?: 'h1' | 'h2' | 'p' | 'div';
  className?: string;
  style?: CSSProperties;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <Tag className={className} style={style} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={`${i}-${word}`}>
          <span className="ec-word-mask" aria-hidden>
            <span className="ec-word" style={{ animationDelay: `${delay + i * stagger}ms` }}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/** When the last word of a RevealText has landed (for chaining the next element). */
export const revealEnd = (text: string, delay = 0, stagger = 75) => delay + Math.max(0, text.split(/\s+/).filter(Boolean).length - 1) * stagger + 450;

/** A slightly wobbly, hand-drawn underline that draws itself in. */
export function Squiggle({ color, delay = 0, className }: { color: string; delay?: number; className?: string }) {
  return (
    <svg viewBox="0 0 320 26" className={className} fill="none" aria-hidden preserveAspectRatio="none">
      <path
        d="M3 16.5c22-7.8 41-9.6 63-5.2 17.6 3.5 30.3 8.7 50.6 7.4 22.4-1.5 34-11.6 57.9-12.4 21.4-.7 33.2 9.3 55.2 9.6 20.7.3 34.2-8.7 55.9-9.3 12.2-.3 21.6 2.3 31.4 5.5"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        pathLength={1}
        className="ec-draw"
        style={{ animationDelay: `${delay}ms` }}
      />
    </svg>
  );
}

/** Darkens the edges so the eye settles in the middle. It sits under the words, so text and logos keep their true colour. */
export function Vignette({ strength = 0.55 }: { strength?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,${strength}) 100%)` }}
      aria-hidden
    />
  );
}

/** Film grain over everything: the texture that stops a gradient from looking computer-made. */
export function Grain() {
  return <div className="ec-grain pointer-events-none absolute -inset-[12%] opacity-[0.06]" aria-hidden />;
}

/**
 * MM:SS where each digit rolls when it changes. The previous digit is drawn by a
 * pseudo-element, so the element's text is always exactly the current time.
 */
export function RollingClock({ ms, live, className }: { ms: number; live?: boolean; className?: string }) {
  return <RollingDigits text={formatClock(ms)} live={live} className={className} />;
}

/** Any digit string ("12:04:59", "+01:25") with the same rolling digits. */
export function RollingDigits({ text, live, className }: { text: string; live?: boolean; className?: string }) {
  return (
    <span className={cn('inline-block whitespace-nowrap tabular-nums', className)} role="timer" aria-label={text}>
      {text.split('').map((ch, i) =>
        ch === ':' || !/\d/.test(ch) ? (
          <span key={`c${i}`} className={cn('ec-digit-slot', ch === ':' && live && 'ec-colon-live')}>
            {ch}
          </span>
        ) : (
          <RollingChar key={`d${text.length - i}`} ch={ch} />
        ),
      )}
    </span>
  );
}

function RollingChar({ ch }: { ch: string }) {
  const [state, setState] = useState({ cur: ch, prev: ch, n: 0 });
  if (state.cur !== ch) setState({ cur: ch, prev: state.cur, n: state.n + 1 });
  return (
    <span className="ec-digit-slot">
      <span key={state.n} className={cn('ec-digit', state.n > 0 && 'ec-digit-roll')} data-prev={state.prev}>
        {state.cur}
      </span>
    </span>
  );
}
