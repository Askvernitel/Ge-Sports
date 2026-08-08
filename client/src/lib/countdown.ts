// Countdowns tick client-side from a server-provided lock timestamp (ISO
// string). Never trust local clocks for actual settlement — this is display
// only, per design README "State Management".

export interface CountdownState {
  label: string; // "MM:SS" or "HH:MM:SS" once past an hour
  pct: number; // 0-100, how "closed" the window is (for the zone ring)
  expired: boolean;
}

/**
 * @param lockAt ISO timestamp when the room locks
 * @param windowMs total countdown window length, used to derive pct closed
 */
export function getCountdown(lockAt: string, windowMs: number, now: number = Date.now()): CountdownState {
  const lockTime = new Date(lockAt).getTime();
  const remainingMs = Math.max(0, lockTime - now);
  const expired = remainingMs <= 0;

  const totalSec = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const label = hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  const elapsedMs = Math.min(windowMs, Math.max(0, windowMs - remainingMs));
  const pct = windowMs > 0 ? Math.min(100, Math.round((elapsedMs / windowMs) * 100)) : 100;

  return { label, pct, expired };
}
