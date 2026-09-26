import { createContext, useContext } from 'react';
import { useTimerRemaining } from './useTimerRemaining';
import type { TimerSnapshot } from '../types';

/** The estimated offset between this browser's clock and the server's (set by the page). */
export const ClockOffsetContext = createContext(0);

/**
 * Remaining time for components that actually draw the countdown. Keeping the
 * several-times-a-second tick down here means only those small components re-render,
 * not the whole console or the projector stage.
 */
export function useLiveRemaining(timer: TimerSnapshot | null | undefined): number {
  return useTimerRemaining(timer ?? null, useContext(ClockOffsetContext));
}
