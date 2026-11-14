import { useEffect, useId, useState } from 'react';

// The band at the top of the profile card. The sky sits in the top right
// corner and fades out towards the rest of the card. From 5 in the morning to
// 5 in the evening (by the viewer's clock) it shows a big glowing sun with
// clouds drifting across it; the rest of the time a half moon with clouds
// drifting around it and a few stars. At 5 the sun sets and the moon rises, or
// the other way round. Everything holds still for people who ask for less motion.

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

// A fixed, random looking star field: the same on every visit.
function seeded(seed) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const TINTS = ['#ffffff', '#fff4d6', '#dfe8ff', '#ffffff', '#e8f0ff'];
const rand = seeded(20261114);
// Faint stars, fewer towards the bottom where the sky fades into the card.
const DIM_STARS = Array.from({ length: 46 }, () => {
  const y = Math.pow(rand(), 1.6) * 62;
  return { x: rand() * 320, y, r: 0.35 + rand() * 0.55, tint: TINTS[Math.floor(rand() * TINTS.length)], delay: rand() * 4, dur: 2.5 + rand() * 3 };
});
// A few bright stars with four point glints.
const BRIGHT_STARS = [
  [212, 12, 1.25, 0.4],
  [150, 22, 1, 1.9],
  [248, 46, 0.9, 2.8],
  [86, 14, 0.95, 1.2],
  [312, 50, 0.85, 3.3],
];

function Glint({ x, y, size, delay }) {
  const arm = size * 5;
  return (
    <g transform={`translate(${x} ${y})`} className="animate-twinkle" style={{ animationDelay: `${delay}s`, animationDuration: '3.6s' }}>
      <circle r={size * 3.4} fill="#fff6d8" opacity="0.16" />
      <path
        d={`M0 ${-arm} L${size * 0.32} ${-size * 0.32} L${arm} 0 L${size * 0.32} ${size * 0.32} L0 ${arm} L${-size * 0.32} ${size * 0.32} L${-arm} 0 L${-size * 0.32} ${-size * 0.32}Z`}
        fill="#fffdf2"
        opacity="0.85"
      />
      <circle r={size * 0.9} fill="#ffffff" />
    </g>
  );
}

// A puffy cloud with a soft shadow under it, drifting past the corner.
function Cloud({ light, shade, opacity = 1, scale = 1, y, duration, delay }) {
  return (
    <g transform={`translate(0 ${y})`} opacity={opacity}>
      <g className="animate-drift-near" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
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
          <stop offset="0.3" stopColor="#fff3b0" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ffd25a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffd25a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="52" fill={`url(#${id}-corona)`} className="origin-center animate-glow [transform-box:fill-box]" />
      <g opacity="0.3" className="origin-center animate-[spin_70s_linear_infinite] [transform-box:fill-box]">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d="M-2 -26 L0 -46 L2 -26Z" fill="#ffd25a" transform={`rotate(${i * (360 / 14)})`} />
        ))}
      </g>
      <circle r="22" fill={`url(#${id}-sun)`} />
    </g>
  );
}

function Moon({ id }) {
  return (
    <g>
      <defs>
        <mask id={`${id}-moon`}>
          <rect x="-30" y="-30" width="60" height="60" fill="white" />
          <circle cx="9" cy="-6" r="15" fill="black" />
        </mask>
        <radialGradient id={`${id}-moonglow`}>
          <stop offset="0.3" stopColor="#f7e9a8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f7e9a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="40" fill={`url(#${id}-moonglow)`} className="origin-center animate-glow [transform-box:fill-box]" />
      <circle r="17" fill="#f9edb8" mask={`url(#${id}-moon)`} />
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
      <svg viewBox="0 0 320 80" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          {/* The sky fades evenly from the top into the card, across the whole width. */}
          <linearGradient id={`${id}-day`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#86c8ff" />
            <stop offset="0.45" stopColor="#bfe2ff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#e6f4ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-night`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1433" />
            <stop offset="0.5" stopColor="#1a2754" stopOpacity="0.88" />
            <stop offset="1" stopColor="#2a3a72" stopOpacity="0" />
          </linearGradient>
          {/* A little more light around the sun or the moon in the corner. */}
          <radialGradient id={`${id}-dayglow`} cx="0.9" cy="0.2" r="0.45">
            <stop offset="0" stopColor="#fff7d1" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fff7d1" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-nightglow`} cx="0.9" cy="0.25" r="0.4">
            <stop offset="0" stopColor="#3b4d8f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#3b4d8f" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-trail`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Day */}
        <g className={`transition-opacity duration-700 ${night ? 'opacity-0' : 'opacity-100'}`}>
          <rect width="320" height="80" fill={`url(#${id}-day)`} />
          <rect width="320" height="80" fill={`url(#${id}-dayglow)`} />
          <g transform="translate(286 22)">
            <g className={`transition-transform duration-1000 ease-in ${night ? 'translate-y-[90px]' : 'translate-y-0'}`}>
              <Sun id={id} />
            </g>
          </g>
          <Cloud light="#ffffff" shade="#d6e7f7" y={2} scale={0.8} duration={24} delay={-4} />
          <Cloud light="#ffffff" shade="#d9e9f8" opacity={0.95} y={22} scale={0.65} duration={30} delay={-17} />
          <Cloud light="#ffffff" shade="#d6e7f7" opacity={0.9} y={36} scale={0.55} duration={21} delay={-11} />
        </g>

        {/* Night */}
        <g className={`transition-opacity duration-700 ${night ? 'opacity-100' : 'opacity-0'}`}>
          <rect width="320" height="80" fill={`url(#${id}-night)`} />
          <rect width="320" height="80" fill={`url(#${id}-nightglow)`} />
          {DIM_STARS.map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill={star.tint}
              opacity={1 - star.y / 80}
              className="animate-twinkle"
              style={{ animationDelay: `${star.delay}s`, animationDuration: `${star.dur}s` }}
            />
          ))}
          {BRIGHT_STARS.map(([x, y, size, delay]) => (
            <Glint key={`${x}-${y}`} x={x} y={y} size={size} delay={delay} />
          ))}
          {/* A shooting star, now and then */}
          <g transform="translate(250 6) rotate(-16)">
            <g className="animate-shoot">
              <rect x="0" y="-0.6" width="34" height="1.2" rx="0.6" fill={`url(#${id}-trail)`} />
              <circle r="1.2" fill="#ffffff" />
            </g>
          </g>
          <g transform="translate(284 26)">
            <g className={`transition-transform delay-200 duration-1000 ease-out ${night ? 'translate-y-0' : 'translate-y-[90px]'}`}>
              <Moon id={id} />
            </g>
          </g>
          <Cloud light="#55639a" shade="#3f4c80" opacity={0.85} y={6} scale={0.75} duration={28} delay={-6} />
          <Cloud light="#4d5b92" shade="#3a4778" opacity={0.75} y={30} scale={0.6} duration={34} delay={-20} />
        </g>
      </svg>
    </div>
  );
}
