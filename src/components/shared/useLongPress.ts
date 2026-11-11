import type { MouseEvent, PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { buzz } from '../../lib/dom.ts';

/** Handlers and state returned by {@link useLongPress}. */
interface LongPress {
  /** The element was just long-pressed (class `lp-hit` for 300 ms). */
  hit: boolean;
  /** Spread on the element. */
  handlers: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onContextMenu: (event: MouseEvent) => void;
    onClickCapture: (event: MouseEvent) => void;
  };
}

/**
 * Short tap keeps the element's own click; a long press (550 ms, finger
 * still within 10 px) runs `onLongPress` and swallows the click that follows
 * (legacy `pressModes`, nav.js:1277-1314: long press on a crew member
 * `[data-m]`, a crew line `[data-cem]`, a crew set or a boat pick opens its card).
 * A press starting inside `.b-editbtn` is ignored.
 * @param onLongPress - Long press action.
 * @param delay - Press duration in ms.
 * @returns State and handlers.
 */
export function useLongPress(onLongPress: () => void, delay = 550): LongPress {
  const [hit, setHit] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swallow = useRef(false);
  const action = useRef(onLongPress);
  useEffect(() => {
    action.current = onLongPress;
  });
  useEffect(() => {
    if (!hit) return undefined;
    const reset = setTimeout(() => setHit(false), 300);
    return () => clearTimeout(reset);
  }, [hit]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const end = () => {
    clearTimeout(timer.current);
    start.current = null;
    if (swallow.current) {
      setTimeout(() => {
        swallow.current = false;
      }, 450);
    }
  };
  return {
    hit,
    handlers: {
      onPointerDown: (event) => {
        clearTimeout(timer.current);
        start.current = null;
        if ((event.target as Element).closest('.b-editbtn')) return;
        start.current = { x: event.clientX, y: event.clientY };
        timer.current = setTimeout(() => {
          if (!start.current) return;
          start.current = null;
          swallow.current = true;
          buzz();
          setHit(true);
          action.current();
        }, delay);
      },
      onPointerMove: (event) => {
        const origin = start.current;
        if (!origin) return;
        if (
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10
        ) {
          clearTimeout(timer.current);
          start.current = null;
        }
      },
      onPointerUp: end,
      onPointerCancel: end,
      onContextMenu: (event) => event.preventDefault(),
      onClickCapture: (event) => {
        if (!swallow.current) return;
        event.preventDefault();
        event.stopPropagation();
        swallow.current = false;
      },
    },
  };
}
