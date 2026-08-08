import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Tweens the displayed value toward `target` over ~500ms whenever it
 * changes (a deposit landing, a room join debiting the balance, etc.),
 * instead of the figure just jump-cutting to the new number. Snaps
 * instantly under prefers-reduced-motion.
 */
export function useAnimatedNumber(target: number, durationMs = 550): number {
  const [displayed, setDisplayed] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion || target === fromRef.current) {
      setDisplayed(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    startRef.current = null;

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, reducedMotion]);

  return displayed;
}
