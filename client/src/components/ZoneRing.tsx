import { tokens } from '@/lib/tokens';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface ZoneRingProps {
  /** 0-100, how far closed the ring is. */
  pct: number;
  /** Ring diameter in px. */
  size: number;
  /** Inner disc diameter in px — if provided, renders a disc with children centered inside. */
  discSize?: number;
  children?: React.ReactNode;
  className?: string;
}

/**
 * The signature "zone ring" motif — always meaning "a clock is running on
 * this". Conic-gradient implementation exactly per design README. Past 80%
 * closed it shifts from zone to flare. Respects prefers-reduced-motion by
 * disabling the transition on the gradient sweep (still a static arc).
 */
export function ZoneRing({ pct, size, discSize, children, className }: ZoneRingProps) {
  const reducedMotion = usePrefersReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const color = clamped > 80 ? tokens.flare : tokens.zone;

  return (
    <div
      className={`zone-ring flex items-center justify-center ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${clamped}%, ${tokens.lichen}33 0)`,
        transition: reducedMotion ? 'none' : 'background 0.6s linear',
      }}
      role="img"
      aria-label={`${clamped}% of the timer elapsed`}
    >
      {discSize ? (
        <div
          className="zone-ring flex flex-col items-center justify-center"
          style={{ width: discSize, height: discSize, background: tokens.ground }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function zoneRingColor(pct: number): string {
  return pct > 80 ? tokens.flare : tokens.zone;
}
