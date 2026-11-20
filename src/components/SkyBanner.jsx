import { useQuery } from '@tanstack/react-query';
import { Cloud as CloudIcon, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Moon as MoonIcon, Snowflake, Sun as SunIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '../lib/api';

// The band at the top of the profile card: the sky over the office right
// now. The server reads the weather in Bhubaneswar every ten minutes (see
// services/weather.js) and the band draws it: day or night by the real sun,
// then clear, a few clouds, overcast, fog, drizzle, rain, or a thunderstorm
// with lightning. A small label says the temperature and the weather. When the
// weather cannot be read, it falls back to the clock: sun and clouds by day,
// the moon and stars by night. Everything holds still for people who ask for
// less motion.

const DAY_FROM = 5;
const NIGHT_FROM = 17;
const clockNight = () => {
  const hour = new Date().getHours();
  return hour < DAY_FROM || hour >= NIGHT_FROM;
};

function useClockNight() {
  const [night, setNight] = useState(clockNight);
  useEffect(() => {
    const timer = setInterval(() => setNight(clockNight()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return night;
}

function useWeather() {
  const { data } = useQuery({
    queryKey: ['weather'],
    queryFn: () => api.get('/weather'),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return data?.available ? data : null;
}

// A fixed, random looking pattern: the same stars and raindrops every visit.
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
const DROPS = Array.from({ length: 80 }, () => ({ x: rand() * 340, delay: -rand() * 1.6, speed: 0.5 + rand() * 0.3, length: 6 + rand() * 7 }));
const FLAKES = Array.from({ length: 30 }, () => ({ x: rand() * 340, delay: -rand() * 6, r: 0.8 + rand() * 1.1 }));

// How each kind of weather looks: how grey the sky is, whether the sun or
// moon shows, how many clouds and how dark, and what falls.
const SCENES = {
  clear: { grey: 0, body: 1, clouds: 1, tone: 'white', drops: 0 },
  partly: { grey: 0, body: 1, clouds: 3, tone: 'white', drops: 0 },
  cloudy: { grey: 0.5, body: 0.35, clouds: 5, tone: 'grey', drops: 0 },
  fog: { grey: 0.45, body: 0.25, clouds: 2, tone: 'grey', drops: 0, fog: true },
  drizzle: { grey: 0.6, body: 0, clouds: 5, tone: 'grey', drops: 26 },
  rain: { grey: 0.78, body: 0, clouds: 5, tone: 'dark', drops: 60 },
  thunder: { grey: 0.95, body: 0, clouds: 5, tone: 'storm', drops: 80, lightning: true },
  snow: { grey: 0.5, body: 0, clouds: 4, tone: 'grey', snow: true },
};

const CLOUD_COLOURS = {
  day: {
    white: ['#ffffff', '#d6e7f7'],
    grey: ['#eef1f5', '#c3ccd8'],
    dark: ['#a9b3c1', '#8794a6'],
    storm: ['#7c8597', '#5d6678'],
  },
  night: {
    white: ['#55639a', '#3f4c80'],
    grey: ['#4b5470', '#363e57'],
    dark: ['#3d4560', '#2b3248'],
    storm: ['#353b52', '#23283a'],
  },
};

// Where the clouds sit, most important first, so fewer clouds keep the best.
const CLOUD_PLACES = [
  { y: 2, scale: 0.8, duration: 24, delay: -4 },
  { y: 22, scale: 0.65, duration: 30, delay: -17, opacity: 0.95 },
  { y: 36, scale: 0.55, duration: 21, delay: -11, opacity: 0.9 },
  { y: -4, scale: 1, duration: 36, delay: -26 },
  { y: 12, scale: 0.9, duration: 27, delay: -9 },
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

// Falling rain: thin slanted streaks.
function Rain({ count, night }) {
  return (
    <g stroke={night ? '#b4c2ee' : '#46617f'} strokeLinecap="round" strokeWidth="1.1" opacity={night ? 0.8 : 0.7}>
      {DROPS.slice(0, count).map((drop, i) => (
        <line
          key={i}
          x1={drop.x}
          y1="0"
          x2={drop.x - 2}
          y2={drop.length}
          className="sky-rain"
          style={{ animationDelay: `${drop.delay}s`, animationDuration: `${drop.speed}s` }}
        />
      ))}
    </g>
  );
}

function Snow() {
  return (
    <g fill="#ffffff" opacity="0.9">
      {FLAKES.map((flake, i) => (
        <circle key={i} cx={flake.x} cy="0" r={flake.r} className="sky-snow" style={{ animationDelay: `${flake.delay}s` }} />
      ))}
    </g>
  );
}

// A thunderstorm: the whole sky lights up now and then (behind the clouds),
// and a bright bolt strikes down in front of them at the same moment.
function LightningFlash() {
  return <rect width="320" height="80" fill="#eef3ff" opacity="0.6" className="sky-flash" />;
}

function LightningBolt() {
  return (
    <g className="sky-flash">
      <path
        d="M236 2 L224 32 L233 32 L220 66 L247 24 L237 24 L248 2Z"
        fill="#fff3a6"
        stroke="#ffffff"
        strokeWidth="1.4"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 4px #ffe066)' }}
      />
    </g>
  );
}

function Fog({ night }) {
  const colour = night ? '#8d96b3' : '#ffffff';
  return (
    <g fill={colour}>
      {[18, 34, 50, 64].map((y, i) => (
        <rect
          key={y}
          x="-40"
          y={y}
          width="400"
          height="7"
          rx="3.5"
          opacity={0.35 - i * 0.05}
          className="sky-fog"
          style={{ animationDelay: `${-i * 2.3}s` }}
        />
      ))}
    </g>
  );
}

const ICONS = {
  clear: [SunIcon, MoonIcon],
  partly: [CloudSun, CloudMoon],
  cloudy: [CloudIcon, CloudIcon],
  fog: [CloudFog, CloudFog],
  drizzle: [CloudDrizzle, CloudDrizzle],
  rain: [CloudRain, CloudRain],
  thunder: [CloudLightning, CloudLightning],
  snow: [Snowflake, Snowflake],
};

const timeOf = (iso) => (iso ? iso.slice(11, 16) : '');

export function SkyBanner({ className = '' }) {
  const id = useId().replace(/:/g, '');
  const weather = useWeather();
  const clock = useClockNight();
  const night = weather ? !weather.isDay : clock;
  const kind = weather?.sky && SCENES[weather.sky] ? weather.sky : 'partly';
  const scene = SCENES[kind];
  const [light, shade] = CLOUD_COLOURS[night ? 'night' : 'day'][scene.tone];
  const showStars = night && scene.body === 1;
  const Icon = ICONS[kind][night ? 1 : 0];

  return (
    <div data-sky={night ? 'night' : 'day'} data-weather={kind} className={`relative overflow-hidden motion-reduce:[&_*]:animate-none ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 320 80" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full">
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
          {/* Grey cloud cover over the sky, the same fade. */}
          <linearGradient id={`${id}-overcast`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={night ? '#151a29' : '#8e9bab'} />
            <stop offset="0.55" stopColor={night ? '#1f2537' : '#b5bfcb'} stopOpacity="0.85" />
            <stop offset="1" stopColor={night ? '#2a3046' : '#dde3ea'} stopOpacity="0" />
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

        {/* The sky, by day or by night */}
        <g className={`transition-opacity duration-700 ${night ? 'opacity-0' : 'opacity-100'}`}>
          <rect width="320" height="80" fill={`url(#${id}-day)`} />
          <rect width="320" height="80" fill={`url(#${id}-dayglow)`} opacity={scene.body} />
        </g>
        <g className={`transition-opacity duration-700 ${night ? 'opacity-100' : 'opacity-0'}`}>
          <rect width="320" height="80" fill={`url(#${id}-night)`} />
          <rect width="320" height="80" fill={`url(#${id}-nightglow)`} opacity={scene.body} />
          {showStars && (
            <>
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
            </>
          )}
        </g>

        {/* The sun sets and the moon rises; behind thick cloud they fade. */}
        <g opacity={scene.body} className="transition-opacity duration-700">
          <g transform="translate(286 22)">
            <g className={`transition-transform duration-1000 ease-in ${night ? 'translate-y-[90px]' : 'translate-y-0'}`}>
              <Sun id={id} />
            </g>
          </g>
          <g transform="translate(284 26)">
            <g className={`transition-transform delay-200 duration-1000 ease-out ${night ? 'translate-y-0' : 'translate-y-[90px]'}`}>
              <Moon id={id} />
            </g>
          </g>
        </g>

        {/* Cloud cover */}
        {scene.grey > 0 && <rect width="320" height="80" fill={`url(#${id}-overcast)`} opacity={scene.grey} />}
        {scene.lightning && <LightningFlash />}
        {CLOUD_PLACES.slice(0, scene.clouds).map((place) => (
          <Cloud key={`${place.y}-${place.duration}`} light={light} shade={shade} {...place} />
        ))}
        {scene.lightning && <LightningBolt />}
        {scene.fog && <Fog night={night} />}
        {scene.drops > 0 && <Rain count={scene.drops} night={night} />}
        {scene.snow && <Snow />}
      </svg>

      {/* The weather in words, top left. */}
      {weather && (
        <p
          title={`${weather.location}, as of ${timeOf(weather.observedAt)}`}
          className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur-sm ${
            night ? 'bg-black/25 text-white' : 'bg-white/70 text-[#1f2a44]'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="tabular-nums">{weather.temperature}°</span>
          <span className="max-w-24 truncate">{weather.label}</span>
          <span className="sr-only">in {weather.location}</span>
        </p>
      )}
    </div>
  );
}
