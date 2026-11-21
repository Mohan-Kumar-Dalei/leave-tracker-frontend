import { useQuery } from '@tanstack/react-query';
import { Cloud as CloudIcon, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Moon as MoonIcon, Snowflake, Sun as SunIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { api } from '../lib/api';
import { CloudCanvas } from './CloudCanvas';
import { LightningCanvas } from './LightningCanvas';
import { useDeviceLocation } from '../lib/deviceLocation';

// The band at the top of the profile card: the sky right now where the
// person is (the app asks for their location when it opens), or over the
// office, Bhubaneswar, Odisha, if they did not allow it.
// The server reads the weather every ten minutes (see services/weather.js)
// and the band draws it: day or night by the real sun,
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

// In development only, ?sky=rain&time=night shows that sky, to see each one.
const SKY_LABELS = {
  clear: 'Clear sky',
  partly: 'Partly cloudy',
  cloudy: 'Overcast',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  thunder: 'Thunderstorm',
  snow: 'Snow',
};
function previewWeather() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const sky = params.get('sky');
  if (!SKY_LABELS[sky]) return null;
  const night = params.get('time') === 'night';
  return { available: true, sky, label: SKY_LABELS[sky], isDay: !night, temperature: night ? 24 : 31, location: 'Preview', observedAt: '' };
}

function useWeather(coords, enabled = true) {
  const { data } = useQuery({
    enabled,
    queryKey: ['weather', coords?.lat ?? null, coords?.lon ?? null],
    queryFn: () => api.get(coords ? `/weather?lat=${coords.lat}&lon=${coords.lon}` : '/weather'),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const preview = previewWeather();
  if (preview) return preview;
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
  clear: { grey: 0, body: 1, clouds: 2, tone: 'white', drops: 0 },
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
  { y: 2, scale: 0.8, duration: 24, delay: -4, shape: 0 },
  { y: 22, scale: 0.65, duration: 30, delay: -17, opacity: 0.95, shape: 1 },
  { y: 36, scale: 0.55, duration: 21, delay: -11, opacity: 0.9, shape: 2 },
  { y: -4, scale: 1, duration: 36, delay: -26, shape: 2 },
  { y: 12, scale: 0.9, duration: 27, delay: -9, shape: 1 },
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

// Clouds. A real cloud has no round edges: it is a soft mass whose outline
// breaks into wisps. Each one here is a few large overlapping ellipses whose
// edges are broken up with fractal noise (an SVG turbulence filter) and then
// softened, in three layers: a shaded underside, the body, and a bright top
// where the light falls. Each cloud is drawn once into an image (by shape and
// colour) and that image drifts, so the noise is not worked out again on
// every frame.
const CLOUD_SHAPES = [
  {
    width: 140,
    height: 70,
    body: [
      [70, 44, 50, 15],
      [48, 34, 26, 19],
      [80, 29, 28, 22],
      [104, 39, 21, 14],
      [32, 45, 18, 11],
    ],
    top: [
      [56, 27, 17, 10],
      [80, 22, 18, 12],
    ],
  },
  {
    width: 120,
    height: 62,
    body: [
      [60, 41, 42, 13],
      [44, 32, 22, 16],
      [70, 28, 22, 18],
      [88, 37, 15, 11],
    ],
    top: [
      [50, 26, 13, 8],
      [70, 21, 14, 10],
    ],
  },
  {
    width: 170,
    height: 72,
    body: [
      [85, 46, 64, 14],
      [50, 37, 26, 16],
      [80, 30, 30, 22],
      [114, 32, 26, 19],
      [140, 42, 18, 11],
      [28, 46, 16, 9],
    ],
    top: [
      [74, 23, 20, 11],
      [112, 25, 17, 11],
    ],
  },
];

const ellipses = (list, fill, extra = '') =>
  list.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${extra}/>`).join('');

// A fluffy edge: noise pushes the outline about, then a blur softens it.
const fluff = (id, seed, frequency, scale, blur) =>
  `<filter id="${id}" x="-40%" y="-60%" width="180%" height="220%">` +
  `<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="4" seed="${seed}" result="n"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
  `<feGaussianBlur in="d" stdDeviation="${blur}"/></filter>`;

const cloudImages = new Map();
function cloudImage(shapeIndex, light, shade, night, glow) {
  const key = `${shapeIndex}|${light}|${shade}|${night}|${glow}`;
  if (cloudImages.has(key)) return cloudImages.get(key);
  const { width, height, body, top } = CLOUD_SHAPES[shapeIndex];
  const underside = body.map(([cx, cy, rx, ry]) => [cx, cy + 6, rx * 0.96, ry * 0.85]);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<defs>${fluff('a', 3 + shapeIndex, 0.05, 18, 2.6)}${fluff('b', 7 + shapeIndex, 0.045, 16, 1.6)}${fluff('c', 11 + shapeIndex, 0.06, 12, 3.2)}` +
    `<filter id="s" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
    // A faint shadow on the sky below.
    `<ellipse cx="${width / 2}" cy="${height - 6}" rx="${width * 0.36}" ry="3" fill="#0b1433" opacity="${night ? 0.28 : 0.1}" filter="url(#s)"/>` +
    // The shaded underside, the body, then the light on top.
    `<g filter="url(#a)">${ellipses(underside, shade)}</g>` +
    `<g filter="url(#b)">${ellipses(body, light)}</g>` +
    `<g filter="url(#c)" opacity="${glow}">${ellipses(top, '#ffffff')}</g>` +
    `</svg>`;
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cloudImages.set(key, uri);
  return uri;
}

// How strongly the light catches the top: full on a fair day, little under
// a rain cloud, almost none at night or in a storm.
const GLOW = { white: 0.9, grey: 0.55, dark: 0.3, storm: 0.12 };

function Cloud({ shape = 0, opacity = 1, scale = 1, y, duration, delay, night, light, shade, tone = 'white' }) {
  const { width, height } = CLOUD_SHAPES[shape];
  // 64 units across at scale 1 for the first shape.
  const k = (scale * 64) / 140;
  const glow = night ? Math.min(GLOW[tone], 0.2) : GLOW[tone];
  return (
    <g transform={`translate(0 ${Math.max(y, 0) - 4})`} opacity={opacity}>
      <g className="animate-drift-near" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
        <image href={cloudImage(shape, light, shade, night, glow)} width={width * k} height={height * k} preserveAspectRatio="none" />
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

// Fog: the sky washed out to a soft grey-white, with banks of mist (blurred,
// so they have no edges) drifting slowly at different speeds, thicker low
// down like real fog over the ground.
function Fog({ id, night }) {
  const mist = night ? '#9aa3bd' : '#f4f6f8';
  return (
    <g>
      <defs>
        <filter id={`${id}-mist`} x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <rect width="320" height="80" fill={mist} opacity={night ? 0.32 : 0.5} />
      <g fill={mist} filter={`url(#${id}-mist)`}>
        {[
          [60, 30, 90, 10, 0.55, 14, 0],
          [230, 22, 110, 9, 0.5, 18, -6],
          [140, 48, 150, 13, 0.75, 12, -3],
          [40, 62, 140, 14, 0.85, 16, -9],
          [270, 60, 130, 15, 0.85, 20, -4],
          [170, 74, 200, 12, 0.95, 15, -11],
        ].map(([cx, cy, rx, ry, opacity, duration, delay]) => (
          <ellipse
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            rx={rx / 2}
            ry={ry}
            opacity={opacity}
            className="sky-fog"
            style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
          />
        ))}
      </g>
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

// `preview` draws a given weather instead of the real one (the development
// gallery of every sky uses it).
export function SkyBanner({ className = '', preview = null }) {
  const id = useId().replace(/:/g, '');
  // Where the person is, if they allowed it when the app opened.
  const { coords } = useDeviceLocation();
  const live = useWeather(coords, !preview);
  const weather = preview ?? live;
  const clock = useClockNight();
  const night = weather ? !weather.isDay : clock;
  const kind = weather?.sky && SCENES[weather.sky] ? weather.sky : 'partly';
  const scene = SCENES[kind];
  const [light, shade] = CLOUD_COLOURS[night ? 'night' : 'day'][scene.tone];
  const showStars = night && scene.body === 1;
  const Icon = ICONS[kind][night ? 1 : 0];
  // Clouds come from WebGL; if it is missing or fails, the SVG ones are drawn.
  const [webgl, setWebgl] = useState(true);
  const drawCloudsInstead = useCallback(() => setWebgl(false), []);

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
            <g className={`transition-[transform,opacity] duration-1000 ease-in ${night ? 'translate-y-[90px] opacity-0' : 'translate-y-0 opacity-100'}`}>
              <Sun id={id} />
            </g>
          </g>
          <g transform="translate(284 26)">
            <g className={`transition-[transform,opacity] delay-200 duration-1000 ease-out ${night ? 'translate-y-0 opacity-100' : 'translate-y-[90px] opacity-0'}`}>
              <Moon id={id} />
            </g>
          </g>
        </g>

        {/* Cloud cover */}
        {scene.grey > 0 && <rect width="320" height="80" fill={`url(#${id}-overcast)`} opacity={scene.grey} />}
        {/* Drawn clouds, only where WebGL is not available. */}
        {!webgl &&
          CLOUD_PLACES.slice(0, scene.clouds).map((place) => (
            <Cloud key={`${place.y}-${place.duration}`} night={night} light={light} shade={shade} tone={scene.tone} {...place} />
          ))}
      </svg>

      {/* The clouds: volumetric, raymarched in WebGL. */}
      {webgl && <CloudCanvas key={`${kind}-${night}`} kind={kind} night={night} onFail={drawCloudsInstead} />}

      {/* In front of the clouds: fog, rain and snow. */}
      <svg aria-hidden="true" viewBox="0 0 320 80" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full">
        {scene.fog && <Fog id={id} night={night} />}
        {scene.drops > 0 && <Rain count={scene.drops} night={night} />}
        {scene.snow && <Snow />}
      </svg>

      {/* A thunderstorm's darkening, strike and flash, over everything. */}
      {scene.lightning && <LightningCanvas />}

      {/* The weather in words, top left. */}
      {weather && (
        <p
          title={`${weather.location}${weather.observedAt ? `, as of ${timeOf(weather.observedAt)}` : ''}`}
          className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur-sm ${
            night ? 'bg-black/25 text-white' : 'bg-white/70 text-[#1f2a44]'
          }`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{weather.temperature}°</span>
          <span className="max-w-24 truncate">{weather.label}</span>
          <span className="sr-only">in {weather.location}</span>
        </p>
      )}
    </div>
  );
}
