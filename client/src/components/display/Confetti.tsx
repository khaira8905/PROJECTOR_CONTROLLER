import { useEffect, useRef } from 'react';

interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  sway: number;
  phase: number;
  rot: number;
  vr: number;
  color: string;
  shape: 'rect' | 'strip' | 'dot';
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Slow, drifting paper confetti. Pieces flutter (their width follows a sine, like
 * paper turning over), sway sideways and fall at different speeds — tuned to feel
 * celebratory without distracting from the words on screen.
 */
export function Confetti({ colors, density = 1 }: { colors: string[]; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let pieces: Piece[] = [];
    let width = 0;
    let height = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const spawn = (atTop: boolean): Piece => {
      const unit = Math.max(4, width / 115);
      const shapeRoll = Math.random();
      const shape: Piece['shape'] = shapeRoll < 0.55 ? 'rect' : shapeRoll < 0.85 ? 'strip' : 'dot';
      return {
        x: rand(0, width),
        y: atTop ? rand(-height * 0.25, -unit * 2) : rand(-height, height),
        w: shape === 'strip' ? unit * 0.75 : unit * rand(0.9, 1.4),
        h: shape === 'strip' ? unit * rand(2.2, 3) : unit * rand(0.5, 0.9),
        vy: height * rand(0.035, 0.085),
        sway: unit * rand(4, 12),
        phase: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI * 2),
        vr: rand(-1.6, 1.6),
        color: colors[Math.floor(Math.random() * colors.length)],
        shape,
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(120, Math.max(20, (width * height) / 15000)) * density);
      pieces = Array.from({ length: count }, () => spawn(false));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        p.y += p.vy * dt;
        p.phase += dt * 1.6;
        p.rot += p.vr * dt;
        if (p.y > height + 20) pieces[i] = spawn(true);
        const x = p.x + Math.sin(p.phase) * p.sway;
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        // Paper turning over: the visible width breathes between 30% and 100%.
        ctx.scale(0.3 + 0.7 * Math.abs(Math.cos(p.phase * 1.3)), 1);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = p.color;
        if (p.shape === 'dot') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [colors, density]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
