import { useEffect, useRef } from 'react';

// A thunderstorm's lightning, after three.js's "lightning strike" example,
// without three.js: plain 2D canvas, drawn only around a strike.
//
// Every 8 seconds the sky slowly darkens; then a stepped leader races down
// from the clouds, the return stroke lights everything up, and the channel
// flickers a few times (re-striking along the same path, shimmering a little)
// before it goes and the sky slowly comes back. Each strike has a new shape
// and place: a jagged main channel built by recursive midpoint displacement,
// with branches that fork again, like the roots of a tree. White-hot core,
// lilac body, violet glow.

const CYCLE = 8; // seconds between strikes
const DARKEN = [1.2, 3.0]; // the sky darkens over these seconds of the cycle
const LEADER = 0.14; // how long the leader takes to reach the ground
const STRIKE = 3.0; // when the leader starts
// The return stroke and its re-strikes: [start, end, brightness], from the
// moment the leader lands.
const FLICKER = [
  [0, 0.09, 1],
  [0.09, 0.16, 0.22],
  [0.16, 0.26, 0.95],
  [0.26, 0.34, 0.3],
  [0.34, 0.5, 0.8],
  [0.5, 0.8, 0.0],
];
const RECOVER = 3.4; // seconds for the sky to come back after the strike

function random(seed) {
  let x = seed % 2147483647 || 1;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

// A jagged line from a to b: each half is pushed sideways by a share of its
// length, again and again (midpoint displacement).
function jagged(a, b, roughness, depth, rand, out = [a]) {
  if (depth === 0) {
    out.push(b);
    return out;
  }
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  const push = (rand() - 0.5) * length * roughness;
  const mid = [(a[0] + b[0]) / 2 + (-dy / length) * push, (a[1] + b[1]) / 2 + (dx / length) * push];
  jagged(a, mid, roughness, depth - 1, rand, out);
  jagged(mid, b, roughness, depth - 1, rand, out);
  return out;
}

// A whole strike: the main channel and its branches (each with a level, for
// thickness, and where along the main channel it starts, for the leader).
function makeStrike(seed, width, height) {
  const rand = random(seed);
  const x0 = width * (0.28 + rand() * 0.55);
  const top = [x0, -height * 0.08];
  const ground = [x0 + (rand() - 0.5) * width * 0.18, height * 1.08];
  const main = jagged(top, ground, 0.42, 6, rand);
  const channels = [{ points: main, level: 0, from: 0 }];
  const fork = (points, level, from) => {
    if (level > 2) return;
    const count = level === 0 ? 3 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i += 1) {
      const at = Math.floor(points.length * (0.15 + rand() * 0.6));
      const start = points[at];
      const side = rand() < 0.5 ? -1 : 1;
      const reach = height * (0.22 + rand() * 0.35) * (level === 0 ? 1 : 0.55);
      const angle = (Math.PI / 2) * (0.35 + rand() * 0.45) * side; // down and out
      const end = [start[0] + Math.sin(angle) * reach, start[1] + Math.cos(angle) * reach];
      const branch = jagged(start, end, 0.5, 4, rand);
      const startsAt = from + (at / points.length) * (1 - from);
      channels.push({ points: branch, level: level + 1, from: startsAt });
      fork(branch, level + 1, startsAt);
    }
  };
  fork(main, 0, 0);
  return channels;
}

// Draws part of a channel (the leader reaching down), with a small shimmer.
function trace(ctx, points, share, shimmer, rand) {
  const last = Math.max(1, Math.floor((points.length - 1) * share));
  ctx.beginPath();
  for (let i = 0; i <= last; i += 1) {
    const [x, y] = points[i];
    const jx = shimmer ? (rand() - 0.5) * shimmer : 0;
    if (i === 0) ctx.moveTo(x + jx, y);
    else ctx.lineTo(x + jx, y);
  }
}

const smooth = (t) => t * t * (3 - 2 * t);

export function LightningCanvas({ className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let raf = 0;
    let running = true;
    let visible = true;
    let strike = null;
    let strikeCycle = -1;
    const begin = performance.now();

    const draw = (now) => {
      if (!running) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const seconds = (now - begin) / 1000;
      const cycle = Math.floor(seconds / CYCLE);
      const t = seconds - cycle * CYCLE;
      ctx.clearRect(0, 0, width, height);

      // When this strike lands, and how bright it is now.
      const landed = STRIKE + LEADER;
      let brightness = 0;
      for (const [from, to, level] of FLICKER) {
        if (t >= landed + from && t < landed + to) brightness = level;
      }
      // The darkness before, during and after the strike.
      let dark = 0;
      if (t >= DARKEN[0] && t < DARKEN[1]) dark = smooth((t - DARKEN[0]) / (DARKEN[1] - DARKEN[0])) * 0.62;
      else if (t >= DARKEN[1] && t < landed + 0.8) dark = 0.62;
      else if (t >= landed + 0.8 && t < landed + 0.8 + RECOVER) dark = 0.62 * (1 - smooth((t - landed - 0.8) / RECOVER));
      if (dark > 0) {
        ctx.fillStyle = `rgba(10, 13, 28, ${dark})`;
        ctx.fillRect(0, 0, width, height);
      }

      const leading = t >= STRIKE && t < landed;
      const lit = brightness > 0;
      if (leading || lit) {
        if (strikeCycle !== cycle) {
          strike = makeStrike(cycle * 7919 + 17, width, height);
          strikeCycle = cycle;
        }
        // The flash lights up the whole sky, pale violet.
        if (lit) {
          ctx.fillStyle = `rgba(239, 228, 255, ${0.62 * brightness})`;
          ctx.fillRect(0, 0, width, height);
        }
        const reach = leading ? (t - STRIKE) / LEADER : 1;
        const glow = leading ? 0.55 : brightness;
        const shimmer = lit ? 1.6 * ratio : 0;
        const rand = random(Math.floor(now / 50));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const channel of strike) {
          if (reach <= channel.from) continue;
          const share = Math.min(1, (reach - channel.from) / Math.max(0.0001, 1 - channel.from));
          const thin = [1, 0.55, 0.35, 0.25][channel.level];
          // Violet glow, lilac body, white core.
          trace(ctx, channel.points, share, shimmer, rand);
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 14 * ratio * glow;
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.55 * glow})`;
          ctx.lineWidth = 6 * thin * ratio;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(216, 180, 254, ${0.9 * glow})`;
          ctx.lineWidth = 2.6 * thin * ratio;
          ctx.stroke();
          ctx.strokeStyle = `rgba(255, 255, 255, ${glow})`;
          ctx.lineWidth = Math.max(0.8, 1.2 * thin) * ratio;
          ctx.stroke();
        }
        ctx.restore();
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const wake = () => {
      cancelAnimationFrame(raf);
      if (running && visible && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            wake();
          })
        : null;
    observer?.observe(canvas);
    document.addEventListener('visibilitychange', wake);
    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
