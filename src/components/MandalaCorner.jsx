// A line art mandala in the spirit of Odisha's jhoti chita: a flower at the
// heart, rings of teardrops with dots, scallops, and lotus petals on the
// outside. It is drawn whole and placed so that only part of it shows in the
// card's corner. Everything is in the current text colour, so each card
// tints it to match.

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

function Turned({ deg, children }) {
  return <g transform={`translate(${C} ${C}) rotate(${deg})`}>{children}</g>;
}

function Dots({ count, radius, size, offset = 0 }) {
  return around(count, offset).map((deg) => (
    <Turned key={`${radius}-${deg}`} deg={deg}>
      <circle cy={-radius} r={size} />
    </Turned>
  ));
}

function Ring({ radius, dash }) {
  return <circle cx={C} cy={C} r={radius} fill="none" strokeDasharray={dash} />;
}

function Scallops({ count, radius }) {
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
  return <path d={d} fill="none" />;
}

export function MandalaCorner({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      className={`pointer-events-none ${className}`}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* The flower at the heart */}
      {around(8).map((deg) => (
        <Turned key={`h${deg}`} deg={deg}>
          <path d={petal(3, 22, 6)} fill="none" />
          <path d={`M0 -5 L0 -17`} />
        </Turned>
      ))}
      {around(8, 22.5).map((deg) => (
        <Turned key={`hs${deg}`} deg={deg}>
          <path d={petal(4, 14, 3.5)} fill="none" />
        </Turned>
      ))}
      <circle cx={C} cy={C} r="3" />
      <Ring radius={26} />
      <Dots count={32} radius={29.5} size={0.9} />

      {/* Teardrops with a dot inside, and small petals between them */}
      {around(12).map((deg) => (
        <Turned key={`t${deg}`} deg={deg}>
          <path d={teardrop(33, 54, 7.5)} fill="none" />
          <path d={teardrop(37, 50, 4)} fill="none" />
          <circle cy={-41} r="1.4" />
        </Turned>
      ))}
      {around(12, 15).map((deg) => (
        <Turned key={`ts${deg}`} deg={deg}>
          <path d={petal(36, 50, 2.6)} fill="none" />
        </Turned>
      ))}
      <Ring radius={57} />
      <Dots count={48} radius={60.5} size={1} />

      {/* Paisley drops with three dots, the middle ring */}
      {around(12, 15).map((deg) => (
        <Turned key={`p${deg}`} deg={deg}>
          <path d={teardrop(64, 84, 9)} fill="none" />
          <circle cy={-70} r="1.3" />
          <circle cx={-2.6} cy={-75} r="1.1" />
          <circle cx={2.6} cy={-75} r="1.1" />
        </Turned>
      ))}
      {around(12).map((deg) => (
        <Turned key={`ps${deg}`} deg={deg}>
          <path d={petal(64, 80, 3.4)} fill="none" />
          <circle cy={-83} r="1.1" />
        </Turned>
      ))}
      <Scallops count={24} radius={87} />
      <Ring radius={86} dash="0.1 3" />

      {/* Lotus petals on the outside */}
      {around(16).map((deg) => (
        <Turned key={`l${deg}`} deg={deg}>
          <path d={lotus(88, 100, 9)} fill="none" />
          <path d={petal(90, 97, 2.6)} fill="none" />
          <circle cy={-93.5} r="0.9" />
        </Turned>
      ))}
    </svg>
  );
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
