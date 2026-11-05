import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** State of an in-place redraw of a screen. */
export interface Redraw {
  /** Changes at every redraw: use it as the `key` of what is redrawn. */
  version: number;
  /**
   * Redraw the screen from scratch.
   * @param scrollTop - Scroll position afterwards; by default the current one.
   */
  redraw: (scrollTop?: number) => void;
}

/**
 * Redraw a screen in place like legacy (`VIEWS.x()`): everything local is reset,
 * the scroll position stays.
 * @returns The version and the redraw function.
 */
export function useRedraw(): Redraw {
  const [version, setVersion] = useState(0);
  const scroll = useRef(0);
  useLayoutEffect(() => {
    if (version > 0) globalThis.scrollTo(0, scroll.current);
  }, [version]);
  const redraw = useCallback((scrollTop = globalThis.scrollY) => {
    scroll.current = scrollTop;
    setVersion((current) => current + 1);
  }, []);
  return { version, redraw };
}
