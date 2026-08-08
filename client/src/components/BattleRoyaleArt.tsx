/**
 * Line-art illustration standing in for real PUBG art: a drop plane, two
 * parachuting figures, and the shrinking "zone" circles — the game's
 * recognizable silhouette, drawn from scratch in the site's own six-color
 * palette. No PUBG assets, trademarks, or likeness involved. Minimal stroke
 * set only, per the design system's "no emoji/icon, small square or plain
 * stroke" rule.
 */
export function BattleRoyaleArt({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 640"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Shrinking zone circles */}
      <circle cx="240" cy="460" r="170" stroke="#A2957A" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="255" cy="470" r="120" stroke="#A2957A" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="265" cy="480" r="72" stroke="#3E7CA3" strokeWidth="2.5" />

      {/* Flight path */}
      <path d="M40 90 L300 150" stroke="#A2957A" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />

      {/* Drop plane (simple cargo silhouette) */}
      <g transform="translate(20,72)">
        <path
          d="M0 18 H86 L104 10 L112 12 L98 20 L112 24 L104 27 L86 20 H40 L28 34 H16 L24 20 H0 Z"
          fill="#E0D6C2"
          fillOpacity="0.9"
        />
        <rect x="46" y="4" width="3" height="14" fill="#E0D6C2" fillOpacity="0.9" />
        <rect x="60" y="2" width="3" height="16" fill="#E0D6C2" fillOpacity="0.9" />
      </g>

      {/* Parachutist 1 */}
      <g transform="translate(210,150)">
        <path d="M0 0 C 6 -20, 34 -20, 40 0" stroke="#E0D6C2" strokeWidth="2" />
        <line x1="2" y1="0" x2="18" y2="34" stroke="#E0D6C2" strokeWidth="1.5" />
        <line x1="38" y1="0" x2="22" y2="34" stroke="#E0D6C2" strokeWidth="1.5" />
        <line x1="14" y1="0" x2="19" y2="34" stroke="#E0D6C2" strokeWidth="1.5" />
        <line x1="26" y1="0" x2="21" y2="34" stroke="#E0D6C2" strokeWidth="1.5" />
        <circle cx="20" cy="42" r="5" fill="#E0D6C2" />
        <line x1="20" y1="47" x2="20" y2="62" stroke="#E0D6C2" strokeWidth="2" />
      </g>

      {/* Parachutist 2, smaller/further */}
      <g transform="translate(300,200) scale(0.7)">
        <path d="M0 0 C 6 -20, 34 -20, 40 0" stroke="#A2957A" strokeWidth="2" />
        <line x1="2" y1="0" x2="18" y2="34" stroke="#A2957A" strokeWidth="1.5" />
        <line x1="38" y1="0" x2="22" y2="34" stroke="#A2957A" strokeWidth="1.5" />
        <circle cx="20" cy="42" r="5" fill="#A2957A" />
        <line x1="20" y1="47" x2="20" y2="62" stroke="#A2957A" strokeWidth="2" />
      </g>

      {/* Ground tick marks inside the inner zone */}
      <g stroke="#3E7CA3" strokeOpacity="0.5" strokeWidth="1">
        <line x1="265" y1="418" x2="265" y2="426" />
        <line x1="317" y1="480" x2="309" y2="480" />
        <line x1="265" y1="542" x2="265" y2="534" />
        <line x1="213" y1="480" x2="221" y2="480" />
      </g>
    </svg>
  );
}
