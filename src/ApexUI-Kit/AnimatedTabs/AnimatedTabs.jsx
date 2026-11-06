import { useId, useRef } from "react";
import { motion } from "framer-motion";

/*
 * ApexUI Animated Tabs, restyled for the register: a controlled underline tab
 * bar. The indicator slides between tabs; arrow keys, Home and End work.
 * Panels are removed because each tab here filters the list below it.
 */
const AnimatedTabs = ({ tabs, value, onChange, label, className = "" }) => {
    const id = useId();
    const refs = useRef([]);
    const index = tabs.findIndex((t) => t.id === value);

    const select = (i) => {
        const t = tabs[(i + tabs.length) % tabs.length];
        refs.current[tabs.indexOf(t)]?.focus();
        onChange(t.id);
    };
    const onKeyDown = (e) => {
        const map = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
        if (map[e.key] === undefined) return;
        e.preventDefault();
        select(map[e.key]);
    };

    return (
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={`relative flex overflow-x-auto border-b border-line [scrollbar-width:none] ${className}`}>
            {tabs.map((t, i) => {
                const on = t.id === value;
                return (
                    <button
                        key={t.id}
                        ref={(el) => (refs.current[i] = el)}
                        role="tab"
                        type="button"
                        aria-selected={on}
                        tabIndex={on ? 0 : -1}
                        onClick={() => select(i)}
                        className={`relative min-h-11 whitespace-nowrap px-3 pb-3 pt-2 text-sm font-medium transition-colors duration-200 sm:px-4 ${on ? "text-ink" : "text-muted hover:text-ink"}`}
                    >
                        {on && (
                            <motion.span
                                layoutId={`${id}-indicator`}
                                className="absolute inset-x-2 -bottom-px h-0.5 bg-accent"
                                transition={{ type: "spring", stiffness: 480, damping: 36 }}
                            />
                        )}
                        <span className="relative">{t.label}</span>
                        {t.count > 0 && <span className="relative ml-2 tabular-nums text-muted">{t.count}</span>}
                    </button>
                );
            })}
        </div>
    );
};

export default AnimatedTabs;
