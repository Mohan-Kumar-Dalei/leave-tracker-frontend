import { useQuery } from '@tanstack/react-query';
import { Cloud as CloudIcon, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Moon as MoonIcon, Snowflake, Sun as SunIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '../lib/api';
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

// Volumetric clouds. Each cloud is a heap of puffs drawn from the back to the
// front, and every puff is lit on its own: bright where the light falls (top
// left), deepening to shadow underneath. Where a front puff overlaps the ones
// behind, its edge shows against their shade, so the billows read in depth.
// A darker flat base, softened edges and a faint shadow below finish it.
// Three shapes, so no two clouds look alike.
const CLOUD_SHAPES = [
  {
    width: 64,
    base: [6, 25, 54, 8],
    // [x, y, radius], back first.
    puffs: [
      [40, 13, 12],
      [26, 15, 13],
      [52, 20, 9.5],
      [14, 22, 9.5],
      [33, 23, 11],
      [21, 26, 7.5],
      [46, 26, 8],
    ],
  },
  {
    width: 52,
    base: [4, 22, 46, 7],
    puffs: [
      [23, 14, 11],
      [35, 16, 9.5],
      [11, 21, 8],
      [45, 21, 7],
      [29, 23, 9],
      [17, 25, 6],
    ],
  },
  {
    width: 72,
    base: [8, 26, 60, 8],
    puffs: [
      [30, 12, 12],
      [45, 10, 13],
      [58, 17, 10],
      [18, 19, 10],
      [38, 22, 12],
      [52, 25, 9],
      [26, 27, 8],
      [64, 26, 6],
    ],
  },
];

// The light and shade, defined once per sky.
function CloudDefs({ id, light, shade, night }) {
  return (
    <>
      {/* One puff: the light catches its top left, the underside is in shade. */}
      <radialGradient id={`${id}-puff`} cx="0.38" cy="0.3" r="0.95" fx="0.34" fy="0.22">
        <stop offset="0" stopColor={night ? light : '#ffffff'} />
        <stop offset="0.55" stopColor={light} />
        <stop offset="1" stopColor={shade} />
      </radialGradient>
      {/* The flat base, darker, as the light does not reach under the cloud. */}
      <linearGradient id={`${id}-cloudbase`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={light} />
        <stop offset="1" stopColor={shade} />
      </linearGradient>
      <filter id={`${id}-cloudsoft`} x="-10%" y="-20%" width="120%" height="140%">
        <feGaussianBlur stdDeviation="0.6" />
      </filter>
      <filter id={`${id}-cloudshadow`} x="-20%" y="-200%" width="140%" height="500%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </>
  );
}

function Cloud({ id, shape = 0, opacity = 1, scale = 1, y, duration, delay, night }) {
  const { width, base, puffs } = CLOUD_SHAPES[shape];
  return (
    <g transform={`translate(0 ${y})`} opacity={opacity}>
      <g className="animate-drift-near" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
        <g transform={`scale(${scale * 0.78})`}>
          <ellipse cx={width / 2} cy={base[1] + base[3] + 2} rx={width * 0.42} ry="2.6" fill="#0b1433" opacity={night ? 0.25 : 0.1} filter={`url(#${id}-cloudshadow)`} />
          <g filter={`url(#${id}-cloudsoft)`}>
            <rect x={base[0]} y={base[1]} width={base[2]} height={base[3]} rx={base[3] / 2} fill={`url(#${id}-cloudbase)`} />
            {puffs.map(([cx, cy, r]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={`url(#${id}-puff)`} />
            ))}
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

// Lightning that forks like the roots of a tree: a jagged main channel from
// the cloud base down past the bottom, with branches splitting off it and
// smaller twigs off those. Built once from a fixed seed, so it is the same
// shape every visit. Real lightning is white at the core with a violet glow.
function forkedBolt(seed, startX) {
  const next = seeded(seed);
  const jitter = (size) => (next() - 0.5) * size;
  const line = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  // The main channel, zig-zagging down.
  const trunk = [[startX, -2]];
  while (trunk[trunk.length - 1][1] < 84) {
    const [x, y] = trunk[trunk.length - 1];
    trunk.push([x + jitter(11), y + 5 + next() * 5]);
  }

  // Branches off the channel, each going down and out to one side, and
  // twigs off the branches.
  const branches = [];
  const twigs = [];
  trunk.slice(2, -2).forEach(([x, y], index) => {
    if (next() > 0.55) return;
    const side = index % 2 === 0 ? 1 : -1;
    const branch = [[x, y]];
    const steps = 3 + Math.floor(next() * 3);
    for (let step = 0; step < steps; step += 1) {
      const [bx, by] = branch[branch.length - 1];
      branch.push([bx + side * (3 + next() * 6) + jitter(3), by + 3 + next() * 5]);
    }
    branches.push(line(branch));
    if (next() < 0.6) {
      const from = branch[1 + Math.floor(next() * (branch.length - 2))];
      const twig = [from];
      for (let step = 0; step < 2 + Math.floor(next() * 2); step += 1) {
        const [tx, ty] = twig[twig.length - 1];
        twig.push([tx - side * (1 + next() * 4) + jitter(2), ty + 2 + next() * 4]);
      }
      twigs.push(line(twig));
    }
  });
  return { trunk: line(trunk), branches, twigs };
}

// Two bolts in different places take turns, one every 8 seconds.
const BOLTS = [
  { ...forkedBolt(7331, 236), delay: 0 },
  { ...forkedBolt(90210, 168), delay: -8 },
];

// Before each strike the whole scene slowly darkens, the strike lights it
// up pale violet for an instant (with the bolt's flickers), and then the
// scene slowly comes back. This sits over the clouds and the rain.
function StormLight() {
  return (
    <>
      <rect width="320" height="80" fill="#0a0d1c" className="storm-dark" />
      {BOLTS.map((bolt) => (
        <rect
          key={bolt.delay}
          width="320"
          height="80"
          fill="#efe4ff"
          className="storm-light"
          style={{ animationDelay: `${bolt.delay}s` }}
        />
      ))}
    </>
  );
}

// The bolts, in front of the clouds: a wide violet glow, a lilac body and a
// white-hot core, each thinner for branches and twigs.
function LightningBolts({ id }) {
  return (
    <>
      <defs>
        <filter id={`${id}-glow`} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {BOLTS.map((bolt) => (
        <g
          key={bolt.delay}
          className="storm-bolt"
          style={{ animationDelay: `${bolt.delay}s` }}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g stroke="#a855f7" opacity="0.9" filter={`url(#${id}-glow)`}>
            <path d={bolt.trunk} strokeWidth="5" />
            {bolt.branches.map((d) => (
              <path key={d} d={d} strokeWidth="3" />
            ))}
          </g>
          <g stroke="#d8b4fe">
            <path d={bolt.trunk} strokeWidth="2.2" />
            {bolt.branches.map((d) => (
              <path key={d} d={d} strokeWidth="1.3" />
            ))}
            {bolt.twigs.map((d) => (
              <path key={d} d={d} strokeWidth="0.8" />
            ))}
          </g>
          <g stroke="#ffffff">
            <path d={bolt.trunk} strokeWidth="1" />
            {bolt.branches.map((d) => (
              <path key={d} d={d} strokeWidth="0.55" />
            ))}
          </g>
        </g>
      ))}
    </>
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
        <defs>
          <CloudDefs id={id} light={light} shade={shade} night={night} />
        </defs>
        {CLOUD_PLACES.slice(0, scene.clouds).map((place) => (
          <Cloud key={`${place.y}-${place.duration}`} id={id} night={night} {...place} />
        ))}
        {scene.fog && <Fog id={id} night={night} />}
        {scene.drops > 0 && <Rain count={scene.drops} night={night} />}
        {scene.snow && <Snow />}
        {scene.lightning && (
          <>
            <StormLight />
            <LightningBolts id={id} />
          </>
        )}
      </svg>

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
