import type { CSSProperties, ReactNode } from 'react';
import type { PublicMedia, Screen, TimerSnapshot } from '../../types';
import { timerTone } from '../../lib/timer';
import { formatEventDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Confetti } from './Confetti';
import { Grain, RevealText, RollingClock, Squiggle, Vignette, revealEnd } from './motion';

/**
 * Special screens (Please Wait, Technical Difficulty, Break, Starting Soon, Coming Up,
 * Thank You, custom). Each has its own small, hand-built motif rather than one
 * template with different colours:
 *   please-wait → slow ripples      technical → TV colour bars + a signal glitch
 *   break       → coffee & steam    starting  → a sweeping clock ring
 *   coming-up   → chevrons pulling  thanks    → falling paper confetti
 *   custom      → drifting bokeh
 * Sizes use container units, so the operator's live preview is an exact miniature.
 */

interface Theme {
  base: string;
  a: string;
  b: string;
  c: string;
  accent: string;
}

const THEMES: Record<string, Theme> = {
  'please-wait': { base: '#060a17', a: 'rgba(59,110,246,.55)', b: 'rgba(124,58,237,.40)', c: 'rgba(14,165,233,.22)', accent: '#9cc2ff' },
  technical: { base: '#0e0905', a: 'rgba(245,158,11,.40)', b: 'rgba(220,38,38,.30)', c: 'rgba(250,204,21,.14)', accent: '#fcd34d' },
  break: { base: '#03100e', a: 'rgba(20,184,166,.42)', b: 'rgba(56,189,248,.24)', c: 'rgba(251,191,36,.16)', accent: '#6ee7d6' },
  starting: { base: '#040c15', a: 'rgba(14,165,233,.46)', b: 'rgba(16,185,129,.30)', c: 'rgba(99,102,241,.22)', accent: '#86d4ff' },
  'coming-up': { base: '#09071a', a: 'rgba(99,102,241,.50)', b: 'rgba(236,72,153,.32)', c: 'rgba(56,189,248,.18)', accent: '#c9b8ff' },
  thanks: { base: '#110716', a: 'rgba(168,85,247,.46)', b: 'rgba(236,72,153,.36)', c: 'rgba(251,191,36,.20)', accent: '#f5b4ff' },
  custom: { base: '#080a10', a: 'rgba(71,85,105,.55)', b: 'rgba(37,99,235,.28)', c: 'rgba(148,163,184,.16)', accent: '#d5dde8' },
};

// Stable references (the confetti canvas restarts if these change).
const CONFETTI = ['#f9a8d4', '#fcd34d', '#a5b4fc', '#6ee7b7', '#f0abfc', '#fde68a', '#93c5fd'];

export interface ScreenSceneProps {
  screen: Pick<Screen, 'title' | 'subtitle' | 'style'> & { background?: PublicMedia | null };
  eventName: string;
  eventDate?: string;
  logo?: PublicMedia | null;
  hideLogo?: boolean;
  /** Countdown to show on the screen (null = none). */
  timer?: TimerSnapshot | null;
  remaining?: number;
  /** Small note for the operator preview only. */
  note?: ReactNode;
}

export function ScreenScene({ screen, eventName, eventDate, logo, hideLogo, timer, remaining = 0, note }: ScreenSceneProps) {
  const style = THEMES[screen.style] ? screen.style : 'custom';
  const theme = THEMES[style];
  const bg = screen.background && !screen.background.missing ? screen.background : null;
  const showLogo = !!logo && !logo.missing && !hideLogo && !bg;

  return (
    <div className="absolute inset-0 overflow-hidden text-white" style={{ background: theme.base }}>
      <Atmosphere theme={theme} background={bg} />
      {!bg && <Motif style={style} theme={theme} timer={timer} remaining={remaining} />}
      <Vignette />

      {style === 'break' ? (
        <SplitLayout screen={screen} theme={theme} eventName={eventName} logo={showLogo ? logo : null} timer={timer} remaining={remaining} />
      ) : style === 'coming-up' ? (
        <ComingUpLayout screen={screen} theme={theme} eventName={eventName} logo={showLogo ? logo : null} timer={timer} remaining={remaining} />
      ) : (
        <CenteredLayout
          screen={screen}
          theme={theme}
          eventName={eventName}
          eventDate={eventDate}
          logo={showLogo ? logo : null}
          timer={timer}
          remaining={remaining}
          glitch={style === 'technical'}
          underline={style === 'thanks' || style === 'custom' || style === 'please-wait'}
        />
      )}

      <Grain />
      {note && <div className="absolute inset-x-0 bottom-[4cqh] text-center text-[1.6cqw] text-white/55">{note}</div>}
    </div>
  );
}

/* ───────────────────────── Atmosphere ───────────────────────── */

function Atmosphere({ theme, background }: { theme: Theme; background: PublicMedia | null }) {
  if (background) {
    return (
      <>
        {background.kind === 'video' ? (
          <video src={background.url} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <img src={background.url} alt="" className="ec-kenburns absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/75" />
      </>
    );
  }
  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="ec-drift-a absolute -inset-[25%]" style={{ background: `radial-gradient(circle at 28% 32%, ${theme.a}, transparent 42%)` }} />
      <div className="ec-drift-b absolute -inset-[25%]" style={{ background: `radial-gradient(circle at 74% 70%, ${theme.b}, transparent 44%)` }} />
      <div className="ec-drift-c absolute -inset-[25%]" style={{ background: `radial-gradient(circle at 60% 20%, ${theme.c}, transparent 38%)` }} />
    </div>
  );
}

/* ───────────────────────── Shared pieces ───────────────────────── */

function Kicker({ text, color, centered, delay = 0 }: { text: string; color: string; centered?: boolean; delay?: number }) {
  return (
    <div className={cn('flex items-center gap-[1.2cqw] font-mono text-[1.25cqw] font-medium tracking-[0.34em] uppercase', centered && 'justify-center')} style={{ color }}>
      <span className="ec-rule h-[0.16cqw] w-[3.6cqw] rounded-full bg-current opacity-80" style={{ animationDelay: `${delay}ms` }} />
      <span className="ec-fade-up" style={{ animationDelay: `${delay + 120}ms` }}>
        {text}
      </span>
      {centered && <span className="ec-rule h-[0.16cqw] w-[3.6cqw] rounded-full bg-current opacity-80" style={{ animationDelay: `${delay}ms`, transformOrigin: '100% 50%' }} />}
    </div>
  );
}

function Logo({ logo, className }: { logo: PublicMedia; className?: string }) {
  return <img src={logo.url} alt="" className={cn('ec-logo-in w-auto object-contain', className)} />;
}

const titleClass = 'font-display text-[7cqw] leading-[0.98] font-[760] tracking-[-0.028em] text-balance';
const subtitleClass = 'ec-blur-in font-serif text-[3.1cqw] leading-[1.15] italic text-white/85 text-balance';

const COUNTDOWN_LABEL: Record<string, string> = {
  'please-wait': 'Resuming in',
  technical: 'Back in',
  break: 'Back in',
  starting: 'Starting in',
  'coming-up': 'Starts in',
};

function Countdown({
  timer,
  remaining,
  theme,
  delay = 0,
  compact,
  label,
}: {
  timer: TimerSnapshot;
  remaining: number;
  theme: Theme;
  delay?: number;
  compact?: boolean;
  label?: string;
}) {
  const tone = timerTone(timer, remaining);
  const fraction = timer.durationMs > 0 ? Math.max(0, Math.min(1, remaining / timer.durationMs)) : 0;
  const color = tone === 'finished' ? '#fca5a5' : tone === 'warning' ? '#fcd34d' : '#ffffff';
  return (
    <div className="ec-fade-up relative inline-flex flex-col items-stretch" style={{ animationDelay: `${delay}ms` }}>
      {label && tone !== 'finished' && (
        <span className="mb-[1.2cqh] font-mono text-[1.2cqw] tracking-[0.34em] text-white/55 uppercase">{label}</span>
      )}
      <div
        className={cn(
          'rounded-[1.6cqw] bg-white/[0.07] px-[2.8cqw] pt-[1.2cqh] pb-[1.6cqh] font-mono font-semibold tracking-[-0.03em] ring-1 ring-white/10 backdrop-blur-sm',
          compact ? 'text-[6.4cqw]' : 'text-[8.6cqw]',
          tone === 'finished' && 'animate-pulse-soft',
        )}
        style={{ color, boxShadow: tone === 'warning' ? '0 0 6cqw rgba(251,191,36,.18)' : undefined }}
      >
        <RollingClock ms={tone === 'finished' ? 0 : remaining} live={timer.status === 'running'} className="leading-none" />
      </div>
      <div className="mx-[1.6cqw] -mt-[0.9cqh] h-[0.45cqh] overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-300 ease-linear" style={{ width: `${fraction * 100}%`, background: tone === 'warning' ? '#fbbf24' : theme.accent }} />
      </div>
    </div>
  );
}

interface LayoutProps {
  screen: ScreenSceneProps['screen'];
  theme: Theme;
  eventName: string;
  eventDate?: string;
  logo: PublicMedia | null | undefined;
  timer?: TimerSnapshot | null;
  remaining: number;
}

/* ───────────────────────── Layouts ───────────────────────── */

function CenteredLayout({ screen, theme, eventName, logo, timer, remaining, glitch, underline }: LayoutProps & { glitch?: boolean; underline?: boolean }) {
  const titleDelay = 380;
  const after = revealEnd(screen.title, titleDelay);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-[8cqw] text-center">
      {logo && <Logo logo={logo} className="mb-[3.5cqh] h-[11cqh]" />}
      <Kicker text={eventName} color={theme.accent} centered delay={120} />
      <div className={cn('mt-[2.6cqh]', glitch && 'ec-glitch')}>
        <RevealText text={screen.title} className={titleClass} delay={titleDelay} />
      </div>
      {underline && <Squiggle color={theme.accent} delay={after} className="mt-[0.6cqh] h-[2.4cqh] w-[min(34cqw,60%)] opacity-90" />}
      {screen.subtitle && (
        <p className={cn(subtitleClass, 'mt-[2.4cqh] max-w-[68cqw]')} style={{ animationDelay: `${after + 120}ms` }}>
          {screen.subtitle}
        </p>
      )}
      {timer && (
        <div className="mt-[4.5cqh]">
          <Countdown timer={timer} remaining={remaining} theme={theme} delay={after + 260} label={COUNTDOWN_LABEL[screen.style]} />
        </div>
      )}
    </div>
  );
}

/** Break: text on the left, a steaming cup on the right. */
function SplitLayout({ screen, theme, eventName, logo, timer, remaining }: LayoutProps) {
  const titleDelay = 360;
  const after = revealEnd(screen.title, titleDelay);
  return (
    <div className="absolute inset-0 grid grid-cols-[1.25fr_1fr] items-center gap-[4cqw] px-[9cqw]">
      <div className="text-left">
        {logo && <Logo logo={logo} className="mb-[4cqh] h-[9cqh]" />}
        <Kicker text={eventName} color={theme.accent} delay={120} />
        <RevealText text={screen.title} className={cn(titleClass, 'mt-[2.6cqh] text-[6.4cqw]')} delay={titleDelay} />
        {screen.subtitle && (
          <p className={cn(subtitleClass, 'mt-[2.4cqh]')} style={{ animationDelay: `${after + 120}ms` }}>
            {screen.subtitle}
          </p>
        )}
        {timer && (
          <div className="mt-[4cqh]">
            <Countdown timer={timer} remaining={remaining} theme={theme} delay={after + 260} compact label={COUNTDOWN_LABEL.break} />
          </div>
        )}
      </div>
      <CoffeeCup color={theme.accent} />
    </div>
  );
}

/** Coming up next: a small eyebrow, the next item huge, chevrons pulling forward. */
function ComingUpLayout({ screen, theme, eventName, logo, timer, remaining }: LayoutProps) {
  const hero = screen.subtitle || screen.title;
  const eyebrow = screen.subtitle ? screen.title : 'Coming up next';
  const titleDelay = 420;
  const after = revealEnd(hero, titleDelay);
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-[9cqw]">
      {logo && <Logo logo={logo} className="absolute top-[6cqh] left-[9cqw] h-[8cqh]" />}
      <Kicker text={eventName} color={theme.accent} delay={100} />
      <p className="ec-fade-up mt-[3cqh] font-serif text-[3.4cqw] text-white/80 italic" style={{ animationDelay: '240ms' }}>
        {eyebrow}
      </p>
      <div className="flex items-end gap-[3cqw]">
        <RevealText text={hero} className={cn(titleClass, 'max-w-[62cqw] text-[7.6cqw]')} delay={titleDelay} />
        <span className="mb-[1.2cqh] flex font-display text-[7cqw] leading-none font-light" style={{ color: theme.accent }} aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="ec-chevron" style={{ animationDelay: `${after + i * 180}ms` }}>
              ›
            </span>
          ))}
        </span>
      </div>
      <div className="mt-[5cqh] h-[0.3cqh] w-[40cqw] overflow-hidden rounded-full bg-white/10">
        <div className="ec-rule h-full w-full rounded-full" style={{ background: theme.accent, animationDelay: `${after}ms`, animationDuration: '1.6s' }} />
      </div>
      {timer && (
        <div className="mt-[4cqh]">
          <Countdown timer={timer} remaining={remaining} theme={theme} delay={after + 200} compact label={COUNTDOWN_LABEL['coming-up']} />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Motifs ───────────────────────── */

function Motif({ style, theme, timer, remaining }: { style: string; theme: Theme; timer?: TimerSnapshot | null; remaining: number }) {
  switch (style) {
    case 'please-wait':
      return <Ripples color={theme.accent} />;
    case 'technical':
      return <ColourBars />;
    case 'starting':
      return <ClockRing color={theme.accent} timer={timer} remaining={remaining} />;
    case 'thanks':
      return <Confetti colors={CONFETTI} />;
    case 'custom':
      return <Bokeh color={theme.accent} />;
    default:
      return null;
  }
}

function Ripples({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="ec-breathe absolute top-1/2 left-1/2 h-[46cqh] w-[46cqh] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${color}22, transparent 65%)` }} />
      {[0, 2.5, 5].map((delay) => (
        <div
          key={delay}
          className="ec-ripple absolute top-1/2 left-1/2 h-[60cqh] w-[60cqh] rounded-full border"
          style={{ borderColor: `${color}55`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

const BARS = ['#d9d9d9', '#d4c531', '#2fc6c9', '#34b547', '#c43ec6', '#c93a3a', '#3446c6'];

/** SMPTE-style colour bars along the bottom and a slow scanline: "please stand by". */
function ColourBars() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="ec-scanline absolute inset-x-0 top-0 h-[16cqh] bg-gradient-to-b from-transparent via-white/[0.05] to-transparent" />
      <div className="ec-bars absolute inset-x-0 bottom-0 flex h-[6.5cqh] opacity-90">
        {BARS.map((c, i) => (
          <div key={c} className="ec-fade-up flex-1" style={{ background: c, animationDelay: `${150 + i * 55}ms` }} />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[6.5cqh] flex h-[1.4cqh] opacity-70">
        {[...BARS].reverse().map((c, i) => (
          <div key={c} className="flex-1" style={{ background: i % 2 ? '#111' : c }} />
        ))}
      </div>
    </div>
  );
}

/** A thin clock ring: ticks, a sweeping second hand, and the countdown's progress arc. */
function ClockRing({ color, timer, remaining }: { color: string; timer?: TimerSnapshot | null; remaining: number }) {
  const fraction = timer && timer.durationMs > 0 ? Math.max(0, Math.min(1, remaining / timer.durationMs)) : null;
  const r = 46;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 h-[86cqh] w-[86cqh] -translate-x-1/2 -translate-y-1/2 opacity-70" aria-hidden>
      <svg viewBox="0 0 100 100" className="ec-fade-up h-full w-full" style={{ animationDuration: '1.4s' }}>
        {Array.from({ length: 60 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1={i % 5 === 0 ? 2.2 : 3}
            x2="50"
            y2={i % 5 === 0 ? 5 : 4}
            stroke={color}
            strokeOpacity={i % 5 === 0 ? 0.55 : 0.22}
            strokeWidth={i % 5 === 0 ? 0.45 : 0.25}
            strokeLinecap="round"
            transform={`rotate(${i * 6} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="0.4" />
        {fraction !== null && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 300ms linear' }}
          />
        )}
      </svg>
      <div className="ec-spin-minute absolute inset-0">
        <div className="absolute top-[1.6%] left-1/2 h-[1.4%] w-[1.4%] -translate-x-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 2cqh ${color}` }} />
      </div>
    </div>
  );
}

const BOKEH = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 1.2 + ((i * 13) % 7) * 0.7,
  duration: 16 + ((i * 7) % 11) * 2,
  delay: -((i * 5) % 17),
  opacity: 0.18 + ((i * 3) % 5) * 0.06,
}));

function Bokeh({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {BOKEH.map((b, i) => (
        <span
          key={i}
          className="ec-float absolute bottom-[-6cqh] rounded-full"
          style={
            {
              left: `${b.left}%`,
              width: `${b.size}cqw`,
              height: `${b.size}cqw`,
              background: color,
              filter: 'blur(0.25cqw)',
              '--d': `${b.duration}s`,
              '--o': b.opacity,
              animationDelay: `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Line-drawn cup with three wisps of steam that rise, curl and fade at their own pace. */
function CoffeeCup({ color }: { color: string }) {
  return (
    <div className="ec-fade-up relative mx-auto aspect-square w-[30cqw]" style={{ animationDelay: '500ms', animationDuration: '1.4s' }} aria-hidden>
      <svg viewBox="0 0 200 200" className="h-full w-full" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        {/* steam */}
        {[
          { d: 'M78 78c-10-12 10-20 0-34s8-22 2-32', delay: '0s' },
          { d: 'M100 80c-11-13 11-21 0-36s9-23 2-33', delay: '1.3s' },
          { d: 'M122 78c-10-12 10-20 0-34s8-22 2-32', delay: '2.6s' },
        ].map((w) => (
          <path key={w.d} d={w.d} strokeWidth="4" opacity="0.8" className="ec-steam" style={{ animationDelay: w.delay }} />
        ))}
        {/* saucer */}
        <path d="M34 168c20 9 112 9 132 0" strokeWidth="5" opacity="0.55" />
        {/* cup */}
        <path d="M52 96h96v34c0 22-18 38-40 38h-16c-22 0-40-16-40-38V96z" strokeWidth="5.5" fill={`${color}14`} />
        <path d="M148 106h8c11 0 18 7 18 16s-7 16-18 16h-10" strokeWidth="5.5" />
        {/* a little hand-drawn highlight */}
        <path d="M64 108c-1 10 1 20 6 28" strokeWidth="3.5" opacity="0.45" />
      </svg>
    </div>
  );
}

/* ───────────────────────── Logo screen ───────────────────────── */

/** Full-screen logo: it resolves out of a blur, breathes softly, and catches a sheen of light. */
export function LogoScene({ logo, eventName, eventDate }: { logo: PublicMedia | null; eventName: string; eventDate: string }) {
  if (logo && !logo.missing) {
    const mask: CSSProperties = {
      WebkitMaskImage: `url("${logo.url}")`,
      maskImage: `url("${logo.url}")`,
      WebkitMaskSize: '100% 100%',
      maskSize: '100% 100%',
    };
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="ec-breathe absolute top-1/2 left-1/2 h-[70cqh] w-[70cqh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,.22),transparent_62%)]" />
        <Vignette strength={0.7} />
        <div className="ec-logo-in relative">
          <img src={logo.url} alt={eventName} className="block h-auto max-h-[62cqh] w-auto max-w-[62cqw]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden" style={mask}>
            <div className="ec-sheen absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          </div>
        </div>
        <Grain />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: THEMES['please-wait'].base }}>
      <Atmosphere theme={THEMES['please-wait']} background={null} />
      <Vignette />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[8cqw] text-center">
        <RevealText text={eventName} className={cn(titleClass, 'text-[8.4cqw]')} delay={200} />
        <p className="ec-fade-up mt-[3cqh] font-mono text-[1.5cqw] tracking-[0.4em] text-white/60 uppercase" style={{ animationDelay: `${revealEnd(eventName, 200) + 100}ms` }}>
          {formatEventDate(eventDate)}
        </p>
      </div>
      <Grain />
    </div>
  );
}
