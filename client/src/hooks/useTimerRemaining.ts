import { useEffect, useState } from 'react';
import { timerRemaining } from '../lib/timer';
import type { TimerSnapshot } from '../types';

/**
 * Re-renders a few times per second while the timer runs. The value itself is
 * always derived from the server's state, never accumulated locally.
 */
export function useTimerRemaining(timer: TimerSnapshot | null, clockOffset: number): number {
  const [, setTick] = useState(0);
  const running = timer?.status === 'running';

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [running]);

  return timer ? timerRemaining(timer, clockOffset) : 0;
}
