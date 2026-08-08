/**
 * Wordmark: the GE-SPORTS mark (client/icon/ge-sports-mark.svg, inlined so
 * its two-tone fill renders crisply at any size) plus GE-SPORTS in the same
 * mono/tracking treatment used throughout the chrome.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" width="18" height="18" className="flex-shrink-0" aria-hidden="true">
        <polygon points="7,29 12,14 17,14 12,29" fill="#E0D6C2" />
        <polygon points="14,29 21,8 26,8 19,29" fill="#3E7CA3" />
      </svg>
      <span className="font-mono text-xs tracking-[2px] text-lichen">GE-SPORTS</span>
    </span>
  );
}
