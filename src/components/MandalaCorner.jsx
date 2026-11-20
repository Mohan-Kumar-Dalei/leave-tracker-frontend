// A line art mandala in the spirit of Odisha's jhoti chita: a flower at the
// heart, rings of teardrops with dots, scallops, and lotus petals on the
// outside. It is placed so that only part of it shows in the card's corner,
// in the current text colour, so each card tints it to match.
//
// The drawing has several hundred shapes. It is built once, as an SVG image,
// and shown as a mask over the text colour: one element on the page that the
// browser draws once and reuses, instead of hundreds of elements per card.

const C = 100; // centre of the 200 by 200 drawing

const around = (count, offset = 0) => Array.from({ length: count }, (_, i) => (360 / count) * i + offset);

// A pointed petal from radius `from` out to radius `to`, pointing up; the
// group around it turns it into place.
const petal = (from, to, width) => {
  const mid = (from + to) / 2;
  return `M0 ${-from} Q${width} ${-mid} 0 ${-to} Q${-width} ${-mid} 0 ${-from}Z`;
};

// A teardrop: round on the inside, pointed on the outside.
const teardrop = (from, to, width) => {
  const shoulder = to - (to - from) * 0.4;
  return `M0 ${-to} C${width * 0.9} ${-shoulder} ${width} ${-from} 0 ${-from} C${-width} ${-from} ${-width * 0.9} ${-shoulder} 0 ${-to}Z`;
};

// A lotus petal with a little curl at each side of its tip.
const lotus = (from, to, width) => {
  const mid = from + (to - from) * 0.55;
  return (
    `M${-width * 0.55} ${-from} C${-width * 1.2} ${-mid} ${-width * 0.5} ${-to + 3} 0 ${-to}` +
    ` C${width * 0.5} ${-to + 3} ${width * 1.2} ${-mid} ${width * 0.55} ${-from}`
  );
};

const line = (d) => `<path d="${d}" fill="none"/>`;
const dot = (cy, r, cx = 0) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const turned = (deg, inner) => `<g transform="translate(${C} ${C}) rotate(${deg})">${inner}</g>`;
const ring = (radius, dash) => `<circle cx="${C}" cy="${C}" r="${radius}" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const dots = (count, radius, size) => around(count).map((deg) => turned(deg, dot(-radius, size))).join('');

function scallops(count, radius) {
  const step = (2 * Math.PI) / count;
  const bump = radius * Math.sin(step / 2);
  const d = around(count)
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const b = a + step;
      const [x1, y1] = [C + radius * Math.sin(a), C - radius * Math.cos(a)];
      const [x2, y2] = [C + radius * Math.sin(b), C - radius * Math.cos(b)];
      return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${bump.toFixed(2)} ${bump.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    })
    .join(' ');
  return line(d);
}

const DRAWING = [
  // The flower at the heart
  around(8).map((deg) => turned(deg, line(petal(3, 22, 6)) + '<path d="M0 -5 L0 -17"/>')).join(''),
  around(8, 22.5).map((deg) => turned(deg, line(petal(4, 14, 3.5)))).join(''),
  `<circle cx="${C}" cy="${C}" r="3"/>`,
  ring(26),
  dots(32, 29.5, 0.9),
  // Teardrops with a dot inside, and small petals between them
  around(12).map((deg) => turned(deg, line(teardrop(33, 54, 7.5)) + line(teardrop(37, 50, 4)) + dot(-41, 1.4))).join(''),
  around(12, 15).map((deg) => turned(deg, line(petal(36, 50, 2.6)))).join(''),
  ring(57),
  dots(48, 60.5, 1),
  // Paisley drops with three dots, the middle ring
  around(12, 15).map((deg) => turned(deg, line(teardrop(64, 84, 9)) + dot(-70, 1.3) + dot(-75, 1.1, -2.6) + dot(-75, 1.1, 2.6))).join(''),
  around(12).map((deg) => turned(deg, line(petal(64, 80, 3.4)) + dot(-83, 1.1))).join(''),
  scallops(24, 87),
  ring(86, '0.1 3'),
  // Lotus petals on the outside
  around(16).map((deg) => turned(deg, line(lotus(88, 100, 9)) + line(petal(90, 97, 2.6)) + dot(-93.5, 0.9))).join(''),
].join('');

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="#000" stroke="#000" stroke-width="0.9" ' +
  `stroke-linejoin="round" stroke-linecap="round">${DRAWING}</svg>`;
const MASK = `url("data:image/svg+xml,${encodeURIComponent(SVG)}") center / contain no-repeat`;
const STYLE = { backgroundColor: 'currentColor', mask: MASK, WebkitMask: MASK };

export function MandalaCorner({ className = '' }) {
  return <span aria-hidden="true" className={`pointer-events-none block ${className}`} style={STYLE} />;
}

// The mandala as a card background: drawn behind everything, with a faint
// layer of the card colour over it so the text stays easy to read. The card
// needs `relative isolate overflow-hidden`; `className` places and tints it.
export function MandalaBackdrop({ className = '' }) {
  return (
    <>
      <MandalaCorner className={`absolute -z-20 opacity-40 dark:opacity-35 ${className}`} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-surface/60" />
    </>
  );
}
