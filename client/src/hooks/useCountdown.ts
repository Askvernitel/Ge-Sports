import { useEffect, useState } from 'react';
import { getCountdown, type CountdownState } from '@/lib/countdown';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Ticks a countdown client-side from a server-provided lock timestamp.
 * Under prefers-reduced-motion the numeric label still updates (it's
 * information, not motion) but callers should skip animating the ring's
 * transition — see ZoneRing, which reads this same preference itself.
 */
export function useCountdown(lockAt: string, windowMs: number): CountdownState {
  const [state, setState] = useState(() => getCountdown(lockAt, windowMs));
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const tick = () => setState(getCountdown(lockAt, windowMs));
    tick();
    // Reduced-motion users still get accurate numbers, just less frequently
    // re-rendered (no visual sweep to justify a 1s cadence).
    const interval = setInterval(tick, reducedMotion ? 5000 : 1000);
    return () => clearInterval(interval);
  }, [lockAt, windowMs, reducedMotion]);

  return state;
}
