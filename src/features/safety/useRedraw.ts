import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import {
  holdScrollAnchoring,
  suspendScrollAnchoring,
} from '../../shell/scrollAnchor.ts';

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
    if (version === 0) return undefined;
    // The back button shows for an instant in a redrawn page, until the nav bar
    // takes it over: the browser must not follow that movement.
    const release = suspendScrollAnchoring();
    globalThis.scrollTo(0, scroll.current);
    const timer = setTimeout(() => {
      globalThis.scrollTo(0, scroll.current);
      release();
    }, 0);
    return () => {
      clearTimeout(timer);
      release();
    };
  }, [version]);
  const redraw = useCallback((scrollTop = globalThis.scrollY) => {
    scroll.current = scrollTop;
    holdScrollAnchoring();
    setVersion((current) => current + 1);
  }, []);
  return { version, redraw };
}
