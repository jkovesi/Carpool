interface RideIllustrationProps {
  className?: string;
}

// Megbízható, mindig működő SVG-alapú illusztráció a hirdetés-kártyákhoz —
// nem függ egy külső képfájltól (ami korábban sérült / nem töltődött be).
export default function RideIllustration({ className }: RideIllustrationProps) {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rideIllustrationGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF385C" />
          <stop offset="100%" stopColor="#B91C46" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#rideIllustrationGradient)" />
      <path
        d="M-20 150 Q 100 100 200 150 T 420 150"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="22"
        fill="none"
      />
      <path
        d="M-20 150 Q 100 100 200 150 T 420 150"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeDasharray="10 10"
        fill="none"
      />
      <g transform="translate(160,95)">
        <path
          d="M0 32 L9 6 A8 8 0 0 1 16.5 1 h47 a8 8 0 0 1 7.5 5 l9 26"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="-6" y="32" width="92" height="22" rx="7" fill="#ffffff" />
        <circle cx="9" cy="56" r="7.5" fill="#B91C46" stroke="#ffffff" strokeWidth="3" />
        <circle cx="71" cy="56" r="7.5" fill="#B91C46" stroke="#ffffff" strokeWidth="3" />
      </g>
    </svg>
  );
}
