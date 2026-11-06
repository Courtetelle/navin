import type { RefObject } from 'react';
import { useEffect } from 'react';

import { createTimerGroup } from '../../lib/timers.ts';

const running = new WeakSet<HTMLInputElement>();

/**
 * Text longer than its field scrolls once, then at every touch (legacy
 * `inputMarquee`, nav.js:1002-1023): 700 ms after the field becomes visible,
 * and on each pointer up; it scrolls back to the start 1.4 s later unless the
 * field has the focus. Use it on every text input of a screen (legacy
 * targeted `input.text:not([type=number])`, `input[type=text]`, `input` without type).
 * @param reference - The input element.
 */
export function useMarquee(
  reference: RefObject<HTMLInputElement | null>,
): void {
  useEffect(() => {
    const input = reference.current;
    if (!input) return undefined;
    let seen = false;
    const timers = createTimerGroup();
    const check = () => {
      if (seen || !input.offsetParent) return;
      seen = true;
      timers.after(700, () => runMarquee(input));
    };
    const onToggle = () => timers.after(50, check);
    const onPointerUp = () => runMarquee(input);
    timers.after(120, check);
    document.addEventListener('toggle', onToggle, true);
    input.addEventListener('pointerup', onPointerUp);
    return () => {
      timers.clear();
      document.removeEventListener('toggle', onToggle, true);
      input.removeEventListener('pointerup', onPointerUp);
    };
  }, [reference]);
}

/**
 * Scroll an overflowing input once with an ease in-out (nav.js:1008-1018).
 * @param input - The input.
 */
export function runMarquee(input: HTMLInputElement): void {
  if (running.has(input) || !input.isConnected) return;
  const max = input.scrollWidth - input.clientWidth;
  if (max <= 4) return;
  const duration = Math.min(6000, Math.max(1500, max * 12));
  const start = performance.now();
  running.add(input);
  const step = (now: number) => {
    if (!input.isConnected) {
      running.delete(input);
      return;
    }
    const progress = Math.min(1, (now - start) / duration);
    input.scrollLeft = max * ease(progress);
    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }
    setTimeout(() => {
      if (document.activeElement !== input) input.scrollLeft = 0;
      running.delete(input);
    }, 1400);
  };
  requestAnimationFrame(step);
}

/**
 * Ease in-out (quadratic).
 * @param progress - 0 to 1.
 * @returns Eased progress.
 */
export function ease(progress: number): number {
  if (progress < 0.5) return 2 * progress * progress;
  const back = 2 - 2 * progress;
  return 1 - (back * back) / 2;
}
