import { startTransition, useRef, useState } from 'react';
import { useSlider } from '../hooks/useSlider';

// Arrow keys, Home and End move between tabs, as in any tab list.
function useTabKeys(count, index, choose, refs) {
  return (event) => {
    const targets = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: count - 1 };
    if (targets[event.key] === undefined) return;
    event.preventDefault();
    const next = (targets[event.key] + count) % count;
    refs.current[next]?.focus();
    choose(next);
  };
}

// The pill moves at once; the view behind it is drawn as a background update,
// so a long list never holds the pill still.
function usePicked(value, onChange) {
  const [picked, setPicked] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setPicked(value);
  }
  const choose = (next) => {
    setPicked(next);
    startTransition(() => onChange(next));
  };
  return [picked, choose];
}

// Segmented filter tabs (All, Pending, Approved...), a white pill on grey.
export function Tabs({ tabs, value, onChange, label, className = '' }) {
  const refs = useRef([]);
  const [picked, choose] = usePicked(value, onChange);
  const index = tabs.findIndex((tab) => tab.id === picked);
  const { track, marker, itemRef } = useSlider(index, { kind: 'pill' });
  const onKeyDown = useTabKeys(tabs.length, index, (next) => choose(tabs[next].id), refs);

  return (
    <div className={`max-w-full overflow-x-auto [scrollbar-width:none] ${className}`}>
      <div
        ref={track}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="relative inline-flex gap-0.5 rounded-xl bg-sunken p-1"
      >
        <span
          ref={marker}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 rounded-lg bg-surface opacity-0 shadow-[0_1px_2px_rgb(16_24_64/0.08),0_2px_8px_-2px_rgb(16_24_64/0.1)] transition-[transform,width,opacity] duration-300 ease-[var(--ease-calm)] motion-reduce:transition-none"
        />
        {tabs.map((tab, position) => {
          const active = tab.id === picked;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                refs.current[position] = element;
                itemRef(position)(element);
              }}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => choose(tab.id)}
              className={`relative h-8 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors duration-200 max-sm:h-10 ${
                active ? 'text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Two or three views side by side (Organisation, Department): a blue pill
// that slides to the one you pick.
export function SegmentedTabs({ tabs, value, onChange, label }) {
  const refs = useRef([]);
  const [picked, choose] = usePicked(value, onChange);
  const index = tabs.findIndex(([key]) => key === picked);
  const { track, marker, itemRef } = useSlider(index, { kind: 'pill' });
  const onKeyDown = useTabKeys(tabs.length, index, (next) => choose(tabs[next][0]), refs);

  return (
    <div
      ref={track}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card [scrollbar-width:none]"
    >
      <span
        ref={marker}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 rounded-lg bg-accent opacity-0 shadow-[0_6px_16px_-8px_var(--color-accent)] transition-[transform,width,opacity] duration-300 ease-[var(--ease-calm)] motion-reduce:transition-none"
      />
      {tabs.map(([key, name], position) => {
        const active = key === picked;
        return (
          <button
            key={key}
            ref={(element) => {
              refs.current[position] = element;
              itemRef(position)(element);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => choose(key)}
            className={`relative shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
              active ? 'text-on-accent' : 'text-muted hover:text-ink'
            }`}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
