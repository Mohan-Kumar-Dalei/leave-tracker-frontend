import { useCallback, useLayoutEffect, useRef } from 'react';

// A marker that slides under the chosen item of a row of tabs: the blue line
// under the top tabs, or the pill behind a segmented control.
//
// It moves with a CSS transform, which the browser animates off the main
// thread, so it glides even while the next page is being drawn. It moves the
// moment a tab is pressed (`slideTo`), before the page changes, and settles on
// the active item after. Line markers are 100px wide and scaled to the tab's
// width; pills change width (rounded corners would stretch if scaled).
const LINE_WIDTH = 100;

export function useSlider(activeIndex, { kind = 'line', inset = 0 } = {}) {
  const track = useRef(null);
  const marker = useRef(null);
  const items = useRef([]);
  const placed = useRef(false);

  const place = useCallback(
    (index, animate) => {
      const item = items.current[index];
      const node = marker.current;
      if (!node) return;
      if (!item) {
        node.style.opacity = '0';
        return;
      }
      const left = item.offsetLeft + inset;
      const width = Math.max(item.offsetWidth - inset * 2, 0);
      const smooth = animate && placed.current;
      node.style.transitionDuration = smooth ? '' : '0s';
      node.style.opacity = '1';
      if (kind === 'line') {
        node.style.transform = `translateX(${left}px) scaleX(${width / LINE_WIDTH})`;
      } else {
        node.style.transform = `translateX(${left}px)`;
        node.style.width = `${width}px`;
        node.style.height = `${item.offsetHeight}px`;
        node.style.top = `${item.offsetTop}px`;
      }
      placed.current = true;
    },
    [kind, inset],
  );

  // Settle on the active item whenever it changes; the first time without
  // animation, so a page opens with the marker already in place.
  useLayoutEffect(() => {
    place(activeIndex, true);
  }, [activeIndex, place]);

  // Text can change size (fonts loading, a badge appearing, the window
  // resizing); keep the marker under its item without animating.
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !track.current) return undefined;
    const observer = new ResizeObserver(() => place(activeIndex, false));
    observer.observe(track.current);
    for (const item of items.current) if (item) observer.observe(item);
    return () => observer.disconnect();
  }, [activeIndex, place]);

  const itemRef = useCallback(
    (index) => (element) => {
      items.current[index] = element;
    },
    [],
  );

  return { track, marker, itemRef, slideTo: (index) => place(index, true), lineWidth: LINE_WIDTH };
}
