import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface Ping {
  id: number;
  x: number;
  y: number;
}

/**
 * A brief expanding ring at the pointer on every click, mounted once near
 * the app root. Purely decorative feedback to go with the crosshair cursor
 * (see index.css) — skipped entirely under prefers-reduced-motion rather
 * than rendered-then-hidden, so nothing flashes into existence for a frame.
 */
export function ClickPing() {
  const [pings, setPings] = useState<Ping[]>([]);
  const nextId = useRef(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    function handleClick(e: MouseEvent) {
      const id = nextId.current++;
      setPings((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setPings((prev) => prev.filter((p) => p.id !== id));
      }, 500);
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <>
      {pings.map((p) => (
        <span key={p.id} className="click-ping" style={{ left: p.x, top: p.y }} />
      ))}
    </>
  );
}
