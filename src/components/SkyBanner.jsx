import { useEffect, useId, useState } from 'react';

// The band at the top of the profile card. From 5 in the morning to 5 in
// the evening (by the viewer's clock) it shows a day sky: a glowing sun,
// drifting clouds and birds. The rest of the time it shows a night sky: a
// half moon, twinkling stars and faint clouds. At 5 the sun sets and the
// moon rises, or the other way round. Everything holds still for people
// who ask for less motion.

const DAY_FROM = 5;
const NIGHT_FROM = 17;

const isNight = () => {
  const hour = new Date().getHours();
  return hour < DAY_FROM || hour >= NIGHT_FROM;
};

function useNight() {
  const [night, setNight] = useState(isNight);
  useEffect(() => {
    const timer = setInterval(() => setNight(isNight()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return night;
}

const STARS = [
  [18, 14, 1.1, 0],
  [44, 30, 0.8, 1.2],
  [70, 12, 1.3, 0.6],
  [96, 40, 0.7, 2.1],
  [122, 20, 1, 1.6],
  [150, 52, 0.8, 0.3],
  [176, 14, 1.2, 2.4],
  [204, 36, 0.8, 0.9],
  [214, 64, 1, 1.9],
  [296, 50, 1.1, 0.5],
  [306, 14, 0.8, 1.4],
  [58, 60, 0.9, 2.7],
  [136, 66, 0.7, 1.1],
  [28, 44, 0.6, 2.2],
];

// A puffy cloud with a soft shadow on its underside.
function Cloud({ light, shade, opacity = 1, scale = 1, y, duration, delay }) {
  return (
    <g transform={`translate(0 ${y})`} opacity={opacity}>
      <g className="animate-drift" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
        <g transform={`scale(${scale})`}>
          <g fill={shade} transform="translate(0 2)">
            <circle cx="12" cy="18" r="8" />
            <circle cx="25" cy="12" r="11" />
            <circle cx="39" cy="17" r="8.5" />
            <rect x="4" y="16" width="44" height="10" rx="5" />
          </g>
          <g fill={light}>
            <circle cx="12" cy="18" r="8" />
            <circle cx="25" cy="12" r="11" />
            <circle cx="39" cy="17" r="8.5" />
            <circle cx="31" cy="9" r="7" />
            <rect x="4" y="16" width="44" height="9" rx="4.5" />
          </g>
        </g>
      </g>
    </g>
  );
}

function Bird({ delay, duration, size = 1 }) {
  return (
    <g className="animate-fly" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
      <g transform={`scale(${size})`}>
        <path
          d="M0 0 Q4 -4 8 0 Q12 -4 16 0"
          fill="none"
          stroke="#33415c"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="origin-center animate-flap [transform-box:fill-box]"
        />
      </g>
    </g>
  );
}

function Sun({ id }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-sun`} cx="0.42" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="0.35" stopColor="#ffec9e" />
          <stop offset="0.75" stopColor="#ffc23d" />
          <stop offset="1" stopColor="#ff9f1c" />
        </radialGradient>
        <radialGradient id={`${id}-corona`}>
          <stop offset="0.35" stopColor="#fff3b0" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#ffd25a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffd25a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Soft light around it, breathing slowly */}
      <circle r="34" fill={`url(#${id}-corona)`} className="origin-center animate-glow [transform-box:fill-box]" />
      {/* Faint rays, turning very slowly */}
      <g opacity="0.35" className="origin-center animate-[spin_60s_linear_infinite] [transform-box:fill-box]">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M-1.6 -16 L0 -30 L1.6 -16Z" fill="#ffd25a" transform={`rotate(${i * 30})`} />
        ))}
      </g>
      <circle r="13" fill={`url(#${id}-sun)`} />
    </g>
  );
}

export function SkyBanner({ className = '' }) {
  const id = useId().replace(/:/g, '');
  const night = useNight();

  return (
    <div
      aria-hidden="true"
      data-sky={night ? 'night' : 'day'}
      className={`relative overflow-hidden motion-reduce:[&_*]:animate-none ${className}`}
    >
      {/* Day */}
      <svg
        viewBox="0 0 320 80"
        preserveAspectRatio="xMidYMid slice"
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${night ? 'opacity-0' : 'opacity-100'}`}
      >
        <defs>
          <linearGradient id={`${id}-day`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7cc4ff" />
            <stop offset="0.6" stopColor="#b9e0ff" />
            <stop offset="1" stopColor="#e9f6ff" />
          </linearGradient>
        </defs>
        <rect width="320" height="80" fill={`url(#${id}-day)`} />
        <g transform="translate(250 30)">
          <g className={`transition-transform duration-1000 ease-in ${night ? 'translate-y-[80px]' : 'translate-y-0'}`}>
            <Sun id={id} />
          </g>
        </g>
        <Cloud light="#ffffff" shade="#d6e7f7" y={2} scale={0.9} duration={70} delay={-20} />
        <Cloud light="#ffffff" shade="#d6e7f7" opacity={0.9} y={36} scale={0.7} duration={55} delay={-45} />
        <Cloud light="#ffffff" shade="#d6e7f7" y={16} scale={1.1} duration={85} delay={-5} />
        <Cloud light="#ffffff" shade="#d9e9f8" opacity={0.85} y={46} scale={0.6} duration={62} delay={-12} />
        <Cloud light="#ffffff" shade="#d6e7f7" opacity={0.95} y={8} scale={0.75} duration={78} delay={-60} />
        <Cloud light="#ffffff" shade="#dbeaf8" opacity={0.8} y={28} scale={0.95} duration={95} delay={-35} />
        <Bird duration={18} delay={-3} />
        <Bird duration={18} delay={-4.2} size={0.75} />
        <Bird duration={24} delay={-14} size={0.85} />
      </svg>

      {/* Night */}
      <svg
        viewBox="0 0 320 80"
        preserveAspectRatio="xMidYMid slice"
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${night ? 'opacity-100' : 'opacity-0'}`}
      >
        <defs>
          <linearGradient id={`${id}-night`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1230" />
            <stop offset="1" stopColor="#1f2c5c" />
          </linearGradient>
          <mask id={`${id}-moon`}>
            <rect x="-20" y="-20" width="40" height="40" fill="white" />
            <circle cx="6" cy="-4" r="10" fill="black" />
          </mask>
        </defs>
        <rect width="320" height="80" fill={`url(#${id}-night)`} />
        {STARS.map(([x, y, r, delay]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={r * 2.6} fill="#fff6c8" opacity="0.18" className="animate-twinkle" style={{ animationDelay: `${delay}s` }} />
            <circle cx={x} cy={y} r={r} fill="#fffbe6" className="animate-twinkle" style={{ animationDelay: `${delay}s` }} />
          </g>
        ))}
        <g transform="translate(250 28)">
          <g className={`transition-transform delay-200 duration-1000 ease-out ${night ? 'translate-y-0' : 'translate-y-[80px]'}`}>
            <g opacity="0.4">
              <circle r="17" fill="#f7e9a8" className="origin-center animate-glow [transform-box:fill-box]" />
            </g>
            <circle r="11" fill="#f9edb8" mask={`url(#${id}-moon)`} />
          </g>
        </g>
        <Cloud light="#c9d4ff" shade="#9eabdb" opacity={0.14} y={10} scale={1} duration={90} delay={-30} />
        <Cloud light="#c9d4ff" shade="#9eabdb" opacity={0.1} y={40} scale={0.8} duration={70} delay={-10} />
        <Cloud light="#c9d4ff" shade="#9eabdb" opacity={0.08} y={24} scale={0.65} duration={80} delay={-55} />
      </svg>
    </div>
  );
}
