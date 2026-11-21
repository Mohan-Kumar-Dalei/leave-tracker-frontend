import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Bars in 3D, lying down (horizontal) or standing up (columns): each bar a
// box with a lighter top and a darker side. The same shapes draw on the page
// and in the PNG picture, so both look alike.

const DEPTH_X = 9;
const DEPTH_Y = 7;

// A colour mixed towards white (amount > 0) or black (amount < 0).
export function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const mix = (channel) => Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// The front, top and side of a box whose front is x, y, w, h.
function box(x, y, w, h, colour) {
  const top = `${x},${y} ${x + DEPTH_X},${y - DEPTH_Y} ${x + w + DEPTH_X},${y - DEPTH_Y} ${x + w},${y}`;
  const side = `${x + w},${y} ${x + w + DEPTH_X},${y - DEPTH_Y} ${x + w + DEPTH_X},${y + h - DEPTH_Y} ${x + w},${y + h}`;
  return [
    { kind: 'polygon', points: side, fill: shade(colour, -0.28), bar: true },
    { kind: 'polygon', points: top, fill: shade(colour, 0.35), bar: true },
    { kind: 'rect', x, y, w, h, fill: colour, bar: true },
  ];
}

// A label in at most two lines of about `chars` letters each.
function lines(text, chars) {
  const words = String(text).split(/\s+/);
  const out = [''];
  for (const word of words) {
    const line = out.at(-1);
    if (!line || `${line} ${word}`.length <= chars) out[out.length - 1] = line ? `${line} ${word}` : word;
    else if (out.length < 2) out.push(word);
    else {
      out[1] = `${out[1]} ${word}`;
    }
  }
  return out.map((line) => (line.length > chars ? `${line.slice(0, Math.max(1, chars - 1))}…` : line));
}

// The shapes for the bars, `width` wide, starting at `top`. Texts carry a
// tone (ink or muted) that the page and the picture each turn into a colour.
export function barShapes({ items, colourOf, width, vertical = false, done = null, top = 0 }) {
  const most = Math.max(1, ...items.map((item) => item.count));
  const base = done ?? items.reduce((sum, item) => sum + item.count, 0);
  const pct = (count) => (base ? Math.round((count / base) * 100) : 0);
  const shapes = [];
  if (!vertical) {
    const room = width - DEPTH_X - 2;
    items.forEach((item, index) => {
      const y = top + 14 + index * 54;
      const colour = colourOf(item, index);
      shapes.push(
        { kind: 'rect', x: 0, y: y + 5, w: 10, h: 10, fill: colour, r: 2 },
        { kind: 'text', x: 16, y: y + 14, text: item.label, tone: 'ink', size: 13 },
        {
          kind: 'text',
          x: width,
          y: y + 14,
          text: `${item.count}`,
          tone: 'ink',
          size: 13,
          weight: 600,
          anchor: 'end',
          after: ` · ${pct(item.count)}%`,
        },
        { kind: 'rect', x: 0, y: y + 28, w: room, h: 14, fill: 'track', r: 3 },
        ...box(0, y + 28, Math.max(3, (room * item.count) / most), 14, colour),
      );
    });
    return { shapes, height: top + 14 + items.length * 54 };
  }
  const chart = 190;
  const slot = width / Math.max(1, items.length);
  const column = Math.min(54, slot * 0.52);
  const floor = top + 34 + chart;
  shapes.push({ kind: 'line', x1: 0, y1: floor + 0.5, x2: width, y2: floor + 0.5 });
  items.forEach((item, index) => {
    const colour = colourOf(item, index);
    const height = Math.max(3, (chart * item.count) / most);
    const x = index * slot + (slot - column - DEPTH_X) / 2;
    const middle = x + (column + DEPTH_X) / 2;
    shapes.push(
      ...box(x, floor - height, column, height, colour),
      {
        kind: 'text',
        x: middle,
        y: floor - height - DEPTH_Y - 20,
        text: `${item.count}`,
        tone: 'ink',
        size: 14,
        weight: 700,
        anchor: 'middle',
      },
      { kind: 'text', x: middle, y: floor - height - DEPTH_Y - 6, text: `${pct(item.count)}%`, tone: 'muted', size: 11, anchor: 'middle' },
    );
    lines(item.label, Math.max(4, Math.floor(slot / 7))).forEach((line, row) => {
      shapes.push({ kind: 'text', x: middle, y: floor + 18 + row * 15, text: line, tone: 'muted', size: 12, anchor: 'middle' });
    });
  });
  return { shapes, height: floor + 18 + 15 + 8 };
}

// The shapes as SVG markup, for the picture.
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function shapesMarkup(shapes, { ink = '#12141a', muted = '#626979', track = '#eef0f3', rule = '#e6e8ec', scale = 1 } = {}) {
  const fillOf = (fill) => (fill === 'track' ? track : fill);
  return shapes
    .map((shape) => {
      if (shape.kind === 'rect')
        return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}"${shape.r ? ` rx="${shape.r}"` : ''} fill="${fillOf(shape.fill)}"/>`;
      if (shape.kind === 'polygon') return `<polygon points="${shape.points}" fill="${shape.fill}"/>`;
      if (shape.kind === 'line') return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${rule}"/>`;
      return `<text x="${shape.x}" y="${shape.y}" font-size="${shape.size * scale}"${shape.weight ? ` font-weight="${shape.weight}"` : ''}${
        shape.anchor ? ` text-anchor="${shape.anchor}"` : ''
      } fill="${shape.tone === 'muted' ? muted : ink}">${esc(shape.text)}${shape.after ? `<tspan font-weight="400" fill="${muted}">${esc(shape.after)}</tspan>` : ''}</text>`;
    })
    .join('\n');
}

// How wide the chart's box is on the page.
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([item]) => setWidth(Math.round(item.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function Bars3D({ items, colourOf, vertical = false, done = null }) {
  const [ref, width] = useWidth();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const { shapes, height } = width
    ? barShapes({ items, colourOf, width: width - DEPTH_X, vertical, done, top: DEPTH_Y })
    : { shapes: [], height: 0 };
  return (
    <div ref={ref} className="w-full min-w-0">
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Chart of what came of the work">
          {/* The empty track goes under the bar. */}
          {shapes
            .filter((shape) => shape.fill === 'track')
            .map((shape, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <rect key={index} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} fill="var(--color-sunken)" />
            ))}
          <g
            style={{
              transformOrigin: vertical ? `0 ${height - 41}px` : '0 0',
              transform: shown ? 'none' : vertical ? 'scaleY(0)' : 'scaleX(0)',
              transition: 'transform 800ms cubic-bezier(.2,.7,.2,1)',
            }}
          >
            {shapes
              .filter((shape) => shape.bar)
              .map((shape, index) =>
                shape.kind === 'polygon' ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <polygon key={index} points={shape.points} fill={shape.fill} />
                ) : (
                  // eslint-disable-next-line react/no-array-index-key
                  <rect key={index} x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill={shape.fill} />
                ),
              )}
          </g>
          {shapes
            .filter((shape) => !shape.bar && shape.fill !== 'track')
            .map((shape, index) => {
              if (shape.kind === 'rect')
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <rect
                    key={index}
                    x={shape.x}
                    y={shape.y}
                    width={shape.w}
                    height={shape.h}
                    rx={shape.r}
                    fill={shape.fill === 'track' ? 'var(--color-sunken)' : shape.fill}
                  />
                );
              if (shape.kind === 'line')
                // eslint-disable-next-line react/no-array-index-key
                return <line key={index} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke="var(--color-line)" />;
              return (
                <text
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  x={shape.x}
                  y={shape.y}
                  fontSize={shape.size}
                  fontWeight={shape.weight}
                  textAnchor={shape.anchor}
                  fill={shape.tone === 'muted' ? 'var(--color-muted)' : 'var(--color-ink)'}
                >
                  {shape.text}
                  {shape.after && (
                    <tspan fontWeight={400} fill="var(--color-muted)">
                      {shape.after}
                    </tspan>
                  )}
                </text>
              );
            })}
        </svg>
      )}
    </div>
  );
}
