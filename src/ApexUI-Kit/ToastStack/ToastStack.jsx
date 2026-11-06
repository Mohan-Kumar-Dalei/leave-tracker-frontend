import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

/*
 * Toast Stack: notifications pile up as a neat stack and fan out on hover.
 * Each one closes itself after `duration` (paused while hovered) or can be
 * swiped away. Call ref.current.show({ title, description, type }) to add one.
 */

const ICONS = {
    success: { icon: CheckCircle2, color: "var(--approved)" },
    error: { icon: XCircle, color: "var(--rejected)" },
    warning: { icon: AlertTriangle, color: "var(--pending)" },
    info: { icon: Info, color: "var(--muted)" },
};

const ToastStack = forwardRef(function ToastStack({ position = "bottom-right", duration = 4000, max = 4, contained = false, className = "" }, ref) {
    const [toasts, setToasts] = useState([]);
    const [hovered, setHovered] = useState(false);
    const timers = useRef(new Map());
    const top = position.startsWith("top");

    const dismiss = useCallback((id) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setToasts((list) => list.filter((t) => t.id !== id));
    }, []);

    useImperativeHandle(ref, () => ({
        show: (toast) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setToasts((list) => [...list, { type: "info", ...toast, id }].slice(-max));
            return id;
        },
        dismiss,
    }));

    // Auto-close, paused while the stack is hovered.
    useEffect(() => {
        if (hovered) {
            timers.current.forEach((t) => clearTimeout(t));
            timers.current.clear();
            return undefined;
        }
        toasts.forEach((t) => {
            if (!timers.current.has(t.id)) timers.current.set(t.id, setTimeout(() => dismiss(t.id), duration));
        });
        return undefined;
    }, [toasts, hovered, duration, dismiss]);

    const place = {
        "bottom-right": "bottom-4 right-4 items-end",
        "bottom-left": "bottom-4 left-4 items-start",
        "top-right": "top-4 right-4 items-end",
        "top-left": "top-4 left-4 items-start",
        "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
        "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
    }[position];

    return (
        <ol
            aria-live="polite"
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            className={`${contained ? "absolute" : "fixed"} z-[200] flex w-[min(22rem,calc(100%-2rem))] flex-col ${place} ${className}`}
        >
            <style>{"@keyframes apex-toast-in{from{opacity:0}to{opacity:1}}"}</style>
            <AnimatePresence initial={false}>
                {toasts.map((t, i) => {
                    const fromEnd = toasts.length - 1 - i;
                    const { icon: Icon, color } = ICONS[t.type] ?? ICONS.info;
                    // Collapsed: cards peek out behind the newest. Hovered: they fan out into a list.
                    const offset = hovered ? fromEnd * 76 : fromEnd * 10;
                    return (
                        <motion.li
                            key={t.id}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.6}
                            onDragEnd={(_, info) => Math.abs(info.offset.x) > 90 && dismiss(t.id)}
                            initial={{ y: top ? -30 : 30, scale: 0.94 }}
                            animate={{ y: top ? offset : -offset, scale: hovered ? 1 : 1 - fromEnd * 0.05 }}
                            exit={{ scale: 0.9, transition: { duration: 0.18 } }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            className={`absolute w-full cursor-grab touch-pan-y list-none active:cursor-grabbing ${top ? "top-0" : "bottom-0"}`}
                            style={{ zIndex: i }}
                        >
                            {/* Cards deeper than three fade out of the collapsed stack. */}
                            <div className="transition-opacity duration-300" style={{ opacity: fromEnd > 2 && !hovered ? 0 : 1 }}>
                                {/* The fade-in is a CSS animation: framer hands opacity to the browser
                                    and, when that finishes, can show the start value for one frame. */}
                                <motion.div
                                    exit={{ opacity: 0, transition: { duration: 0.18 } }}
                                    style={{ animation: "apex-toast-in 0.22s ease-out backwards" }}
                                    className="relative flex items-start gap-3 rounded border border-line bg-surface p-3.5 pr-9 text-ink shadow-[0_8px_24px_-12px_rgba(28,35,33,0.35)]">
                                    <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} style={{ color }} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">{t.title}</p>
                                        {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
                                    </div>
                                    <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded text-muted hover:bg-sunken hover:text-ink">
                                        <X className="h-4 w-4" strokeWidth={1.5} />
                                    </button>
                                </motion.div>
                            </div>
                        </motion.li>
                    );
                })}
            </AnimatePresence>
        </ol>
    );
});

export default ToastStack;
