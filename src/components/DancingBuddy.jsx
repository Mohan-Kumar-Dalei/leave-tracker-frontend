// A small cartoon friend in sunglasses who dances on the weekend note: the
// whole body sways, the arms wave, the feet step, and music notes float up.
// The moves are in index.css (.buddy-*); with reduced motion they stand still.
export function DancingBuddy({ className = '' }) {
  return (
    <svg viewBox="0 0 64 76" className={className} aria-hidden="true">
      <ellipse className="buddy-shadow" cx="32" cy="72" rx="14" ry="3" fill="#a8650b" opacity="0.18" />
      <text className="buddy-note" x="50" y="26" fontSize="11" fill="#f2a93b">
        ♪
      </text>
      <text className="buddy-note buddy-note-late" x="5" y="36" fontSize="10" fill="#e5484d">
        ♫
      </text>
      <g className="buddy-body">
        {/* Legs and shoes. */}
        <g className="buddy-leg-left">
          <line x1="28" y1="54" x2="25" y2="66" stroke="#3b2a1a" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="24" cy="67.5" rx="4.2" ry="2.4" fill="#e5484d" />
        </g>
        <g className="buddy-leg-right">
          <line x1="36" y1="54" x2="39" y2="66" stroke="#3b2a1a" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="40" cy="67.5" rx="4.2" ry="2.4" fill="#e5484d" />
        </g>
        {/* Arms up, waving. */}
        <g className="buddy-arm-left">
          <line x1="24" y1="40" x2="12" y2="29" stroke="#ffcf9e" strokeWidth="4" strokeLinecap="round" />
          <circle cx="12" cy="29" r="2.8" fill="#ffcf9e" />
        </g>
        <g className="buddy-arm-right">
          <line x1="40" y1="40" x2="52" y2="29" stroke="#ffcf9e" strokeWidth="4" strokeLinecap="round" />
          <circle cx="52" cy="29" r="2.8" fill="#ffcf9e" />
        </g>
        {/* Shirt with a little sun on it. */}
        <rect x="22" y="35" width="20" height="21" rx="8" fill="#2f5bea" />
        <circle cx="32" cy="45" r="3.2" fill="#f2a93b" />
        {/* Head, hair, sunglasses and a big smile. */}
        <circle cx="32" cy="22" r="13" fill="#ffd2a1" />
        <path d="M19.5 20c0-8 5.5-13 12.5-13s12.5 5 12.5 13c-2-4-6-6.5-12.5-6.5S21.5 16 19.5 20z" fill="#3b2a1a" />
        <rect x="22.5" y="19" width="8" height="5" rx="2.2" fill="#1d2433" />
        <rect x="33.5" y="19" width="8" height="5" rx="2.2" fill="#1d2433" />
        <line x1="30.5" y1="20.6" x2="33.5" y2="20.6" stroke="#1d2433" strokeWidth="1.4" />
        <line x1="24.5" y1="20.4" x2="26.5" y2="20.4" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        <circle cx="24.5" cy="27.2" r="1.8" fill="#ff8a80" opacity="0.6" />
        <circle cx="39.5" cy="27.2" r="1.8" fill="#ff8a80" opacity="0.6" />
        <path d="M27 28.5q5 4.2 10 0" stroke="#7a3b12" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
