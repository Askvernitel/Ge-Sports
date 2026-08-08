/**
 * Wordmark: a small zone-filled square mark (matches the profile chip's
 * language — small solid squares in a semantic color stand in for icons
 * everywhere in this design, per the handoff spec) plus GE-SPORTS in the
 * same mono/tracking treatment the old "PUBG WAGER" text used.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="w-[18px] h-[18px] bg-zone text-ground font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        GE
      </span>
      <span className="font-mono text-xs tracking-[2px] text-lichen">GE-SPORTS</span>
    </span>
  );
}
