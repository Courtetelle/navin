import { useLayoutEffect, useRef } from 'react';

/**
 * Keep the scroll position across a rebuild of the screen, like the legacy
 * in-place renders (the browser loses it while React swaps the content). It is
 * set again before the next paint because the nav bar hides the page's back
 * button only after this commit, which moves the content.
 * @returns Call it just before the state change that rebuilds the screen.
 */
export function useKeepScroll(): () => void {
  const saved = useRef<number | null>(null);
  useLayoutEffect(() => {
    const position = saved.current;
    if (position === null) return;
    saved.current = null;
    const restore = () => globalThis.scrollTo(0, position);
    restore();
    requestAnimationFrame(restore);
  });
  return () => {
    saved.current = globalThis.scrollY;
  };
}
