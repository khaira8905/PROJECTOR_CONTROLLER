import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { SystemStatus } from '../types';

/** Polls cloud-storage / conversion health for the status bar. */
export function useSystemStatus(intervalMs = 15_000) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .status()
        .then((s) => {
          if (cancelled) return;
          setStatus(s);
          setReachable(true);
        })
        .catch(() => !cancelled && setReachable(false));
    void load();
    const id = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return { status, reachable };
}
