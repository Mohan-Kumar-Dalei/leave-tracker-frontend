import { Check, ChevronDown } from 'lucide-react';
import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

const GAP = 6;
const OPTION_HEIGHT = 38;
const MAX_LIST_HEIGHT = 288;

function readOptions(children) {
  return Children.toArray(children)
    .filter(isValidElement)
    .map((option) => ({
      value: String(option.props.value),
      label: Children.toArray(option.props.children).join(''),
    }));
}

// A dropdown that takes the same <option> children and onChange as a native
// select. The list opens in the browser's top layer, so a card or a dialog
// cannot cut it off. Focus stays on the button and the arrow keys move a highlight.
export function Select({ value, onChange, children, id, className = '', triggerClassName = '', 'aria-label': ariaLabel }) {
  const options = useMemo(() => readOptions(children), [children]);
  const selectedIndex = options.findIndex((option) => option.value === String(value ?? ''));
  const shown = options[selectedIndex] ?? options[0];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState(null);
  const trigger = useRef(null);
  const list = useRef(null);
  const listId = useId();

  const close = useCallback(() => setOpen(false), []);

  const openList = () => {
    const box = trigger.current.getBoundingClientRect();
    const roomBelow = window.innerHeight - box.bottom - GAP * 2;
    const roomAbove = box.top - GAP * 2;
    const wanted = Math.min(options.length * OPTION_HEIGHT + 10, MAX_LIST_HEIGHT);
    const flip = roomBelow < wanted && roomAbove > roomBelow;

    setPlace({
      inset: 'auto',
      left: box.left,
      width: box.width,
      maxHeight: Math.min(flip ? roomAbove : roomBelow, MAX_LIST_HEIGHT),
      ...(flip ? { bottom: window.innerHeight - box.top + GAP } : { top: box.bottom + GAP }),
    });
    setActive(Math.max(selectedIndex, 0));
    setOpen(true);
  };

  const choose = (index) => {
    const option = options[index];
    if (option) onChange?.({ target: { value: option.value } });
    close();
  };

  useLayoutEffect(() => {
    if (open) list.current?.showPopover();
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      const inside = trigger.current?.contains(event.target) || list.current?.contains(event.target);
      if (!inside) close();
    };
    const onScroll = (event) => {
      if (!list.current?.contains(event.target)) close();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  const jumpToLetter = (letter) => {
    const count = options.length;
    for (let step = 1; step <= count; step += 1) {
      const index = (active + step) % count;
      if (options[index].label.toLowerCase().startsWith(letter)) {
        setActive(index);
        return;
      }
    }
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    const last = options.length - 1;
    const moves = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };

    if (moves[event.key] !== undefined) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      // Closes only the list, not a dialog around it.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    } else if (event.key.length === 1) {
      jumpToLetter(event.key.toLowerCase());
    }
  };

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`flex items-center justify-between gap-2 text-left aria-expanded:border-accent aria-expanded:ring-3 aria-expanded:ring-accent/15 ${triggerClassName}`}
      >
        <span className="min-w-0 truncate">{shown?.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          popover="manual"
          aria-label={ariaLabel}
          style={place}
          className="m-0 animate-pop-in overflow-y-auto rounded-xl border border-line bg-surface p-1 text-ink shadow-float motion-reduce:animate-none"
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={`flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm max-sm:min-h-11 ${
                  index === active ? 'bg-sunken' : ''
                } ${selected ? 'font-medium text-accent' : ''}`}
              >
                <span className="min-w-0">{option.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}
