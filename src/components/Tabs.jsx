import { motion } from 'framer-motion';
import { useId, useRef } from 'react';

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
