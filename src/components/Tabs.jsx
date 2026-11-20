import { motion } from 'framer-motion';
import { startTransition, useId, useRef, useState } from 'react';

// Segmented filter tabs. Arrow keys, Home and End move between them.
export function Tabs({ tabs, value, onChange, label, className = '' }) {
  const id = useId();
  const refs = useRef([]);
  const index = tabs.findIndex((tab) => tab.id === value);

  const select = (position) => {
    const next = (position + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };

  const onKeyDown = (event) => {
    const targets = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (targets[event.key] === undefined) return;
    event.preventDefault();
    select(targets[event.key]);
  };

  return (
    <div className={`max-w-full overflow-x-auto [scrollbar-width:none] ${className}`}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="inline-flex gap-0.5 rounded-lg bg-sunken p-0.5">
        {tabs.map((tab, position) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                refs.current[position] = element;
              }}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`relative h-8 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors max-sm:h-10 ${
                active ? 'text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`${id}-tab`}
                  className="absolute inset-0 rounded-md bg-surface shadow-card"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Two or three views side by side (Organisation, Department). The blue pill
// slides to the one you pick at once; the view itself is drawn as a
// background update, so a long list does not hold the pill still. Arrow keys,
// Home and End move between them.
export function SegmentedTabs({ tabs, value, onChange, label }) {
  const id = useId();
  const refs = useRef([]);
  const [picked, setPicked] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setPicked(value);
  }
  const choose = (key) => {
    setPicked(key);
    startTransition(() => onChange(key));
  };
  const index = tabs.findIndex(([key]) => key === picked);
  const onKeyDown = (event) => {
    const targets = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (targets[event.key] === undefined) return;
    event.preventDefault();
    const next = (targets[event.key] + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    choose(tabs[next][0]);
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-1 [scrollbar-width:none]"
    >
      {tabs.map(([key, name], position) => {
        const active = key === picked;
        return (
          <button
            key={key}
            ref={(element) => {
              refs.current[position] = element;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => choose(key)}
            className={`relative shrink-0 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
              active ? 'text-on-accent' : 'text-muted hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${id}-pill`}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-accent shadow-card"
                transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }}
              />
            )}
            <span className="relative">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
