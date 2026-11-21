import { useEffect, useRef } from 'react';

// Volumetric clouds in WebGL, after "WebGL Clouds" (beginor/webgl-clouds):
// fractal Brownian motion noise makes a 3D cloud field, and every pixel
// raymarches through it. At each step inside a cloud a few more steps go
// towards the sun to see how much cloud is in the way (self-shadowing), so a
// cloud is bright where the sun reaches it, grey inside and underneath, with
// soft, wispy edges that slowly change as the wind carries it. How much of the
// sky is cloud, and its colours, follow the weather; at night the light is the
// moon's. Kept light for a small band: 16 steps with 3 towards the sun, drawn
// at about half resolution (clouds are soft), about 24 times a second, and
// only while on screen. Plain WebGL, no library.
// Without WebGL (or if its context is lost), onFail lets the banner draw its
// own clouds instead.

// How much of the sky is cloud, how low it reaches, and how thick it looks.
const WEATHER = {
  clear: { coverage: 0.43, base: 0.4, thickness: 0.9 },
  partly: { coverage: 0.53, base: 0.3, thickness: 1.0 },
  cloudy: { coverage: 0.72, base: 0.12, thickness: 1.1 },
  fog: { coverage: 0.62, base: -0.2, thickness: 0.7 },
  drizzle: { coverage: 0.74, base: 0.1, thickness: 1.15 },
  rain: { coverage: 0.8, base: 0.04, thickness: 1.3 },
  thunder: { coverage: 0.86, base: 0.0, thickness: 1.45 },
  snow: { coverage: 0.72, base: 0.1, thickness: 1.1 },
};

// Lit and shadowed colours: [day lit, day shadow, night lit, night shadow].
const COLOURS = {
  clear: ['#ffffff', '#a9b9cf', '#7a87b3', '#252c49'],
  partly: ['#ffffff', '#a3b3c9', '#7a87b3', '#252c49'],
  cloudy: ['#f4f6f9', '#8f9cae', '#6b7699', '#20263d'],
  fog: ['#f7f8fa', '#c3cad4', '#7d86a3', '#3a4160'],
  drizzle: ['#e3e8ee', '#7f8a9a', '#5e6889', '#1c2236'],
  rain: ['#d2d8e0', '#69737f', '#525b79', '#181d2e'],
  thunder: ['#aab1bf', '#434a58', '#454d68', '#11141f'],
  snow: ['#f6f8fb', '#9ca8b8', '#76809f', '#232a42'],
};

const hex = (value) => {
  const n = Number.parseInt(value.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

// The noise is the 3D FBM from shadertoy.com/view/lss3zr, as in the reference.
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uResolution;
uniform float uTime, uCoverage, uBase, uThickness;
uniform vec3 uLit, uShadow, uSun;

const mat3 m = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
             mix(mix(hash(n + 113.0), hash(n + 114.0), f.x), mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float f = 0.0;
  f += 0.5000 * noise(p); p = m * p * 2.02;
  f += 0.2500 * noise(p); p = m * p * 2.03;
  f += 0.1250 * noise(p); p = m * p * 2.01;
  f += 0.0625 * noise(p);
  return f;
}

// The cloud field: noise above a threshold set by how cloudy it is, in a layer
// with a flatter base and a rounded top, carried by the wind and slowly
// changing shape.
float density(vec3 p) {
  vec3 q = p * vec3(1.7, 2.3, 1.7) + vec3(uTime * 0.045, 0.0, uTime * 0.012);
  float n = fbm(q);
  float layer = smoothstep(uBase, uBase + 0.22, p.y) * (1.0 - smoothstep(0.95, 1.35, p.y));
  return clamp((n - (1.0 - uCoverage)) * 4.6 * layer, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  // Rounder, puffier clouds: the same scale across as up and down.
  vec2 q = vec2(uv.x * aspect * 0.85, uv.y);

  const float STEPS = 16.0;
  const float LIGHT_STEPS = 3.0;
  float jitter = hash(gl_FragCoord.x * 12.9898 + gl_FragCoord.y * 78.233);
  vec3 sun = normalize(uSun);

  vec3 colour = vec3(0.0);
  float transmit = 1.0;
  for (float i = 0.0; i < STEPS; i++) {
    float z = (i + jitter) / STEPS * uThickness;
    vec3 p = vec3(q.x, q.y, z);
    float d = density(p);
    if (d > 0.002) {
      // How much cloud lies between this point and the sun.
      float block = 0.0;
      vec3 lp = p;
      for (float s = 0.0; s < LIGHT_STEPS; s++) {
        lp += sun * 0.1;
        block += density(lp);
      }
      // Beer's law for the shadow, and a little "powder" brightening at the
      // thin edges, which is what makes the rims of real clouds glow.
      float light = exp(-block * 1.25) * (1.0 - exp(-d * 6.0)) * 1.35;
      vec3 c = mix(uShadow, uLit, clamp(light, 0.0, 1.0));
      float a = clamp(d * 0.6 * (uThickness * 22.0 / STEPS), 0.0, 1.0);
      colour += transmit * a * c;
      transmit *= 1.0 - a;
      if (transmit < 0.02) break;
    }
  }
  float alpha = 1.0 - transmit;
  gl_FragColor = vec4(colour, alpha);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

export function CloudCanvas({ kind = 'partly', night = false, onFail, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      onFail?.();
      return undefined;
    }
    let raf = 0;
    let running = true;
    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(program);

      // One quad over the whole band; the fragment shader does the rest.
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const at = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);

      const u = (name) => gl.getUniformLocation(program, name);
      const weather = WEATHER[kind] ?? WEATHER.partly;
      const [dayLit, dayShadow, nightLit, nightShadow] = COLOURS[kind] ?? COLOURS.partly;
      gl.uniform1f(u('uCoverage'), weather.coverage);
      gl.uniform1f(u('uBase'), weather.base);
      gl.uniform1f(u('uThickness'), weather.thickness);
      gl.uniform3fv(u('uLit'), hex(night ? nightLit : dayLit));
      gl.uniform3fv(u('uShadow'), hex(night ? nightShadow : dayShadow));
      // The sun (or moon) sits at the top right of the band.
      gl.uniform3fv(u('uSun'), [0.75, 0.55, -0.35]);
      const timeAt = u('uTime');
      const resolutionAt = u('uResolution');

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      let visible = true;
      // Clouds are soft, so a low resolution looks the same and costs little.
      const resize = () => {
        const width = Math.max(1, Math.round(canvas.clientWidth * 0.55));
        const height = Math.max(1, Math.round(canvas.clientHeight * 0.55));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolutionAt, width, height);
      };
      const start = performance.now() - 30000;
      let last = 0;
      const draw = (now) => {
        if (!running) return;
        // About 24 frames a second is plenty for drifting clouds.
        if (now - last >= 41 || still) {
          last = now;
          resize();
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform1f(timeAt, (now - start) / 1000);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        if (!still && visible && !document.hidden) raf = requestAnimationFrame(draw);
      };
      // Only animate while the band is on screen and the tab is open.
      const wake = () => {
        cancelAnimationFrame(raf);
        if (running) raf = requestAnimationFrame(draw);
      };
      const observer =
        typeof IntersectionObserver !== 'undefined'
          ? new IntersectionObserver(([entry]) => {
              visible = entry.isIntersecting;
              if (visible) wake();
            })
          : null;
      observer?.observe(canvas);
      document.addEventListener('visibilitychange', wake);
      const lost = (event) => {
        event.preventDefault();
        running = false;
        onFail?.();
      };
      canvas.addEventListener('webglcontextlost', lost);
      raf = requestAnimationFrame(draw);

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        observer?.disconnect();
        document.removeEventListener('visibilitychange', wake);
        canvas.removeEventListener('webglcontextlost', lost);
        gl.deleteBuffer(quad);
        gl.deleteProgram(program);
      };
    } catch {
      running = false;
      onFail?.();
      return undefined;
    }
  }, [kind, night, onFail]);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
