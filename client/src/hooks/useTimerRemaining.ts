import { useEffect, useState } from 'react';
import { timerRemaining } from '../lib/timer';
import type { TimerSnapshot } from '../types';

/**
 * Re-renders a few times per second while the timer runs. The value itself is
 * always derived from the server's state, never accumulated locally.
 */
export function useTimerRemaining(timer: TimerSnapshot | null, clockOffset: number): number {
  const [, setTick] = useState(0);
  // A finished countdown keeps ticking too: the operator console counts the overtime.
  const running = timer?.status === 'running' || timer?.status === 'finished';

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [running]);

  return timer ? timerRemaining(timer, clockOffset) : 0;
}
