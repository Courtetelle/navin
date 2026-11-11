import { hideToast } from '../toastControl.ts';

/** The last touch on the page, used to keep the bubble off the button just touched. */
interface LastTouch {
  /** The button-like element touched, if any. */
  element: Element | null;
  /** Vertical position of the touch. */
  y: number;
  /** Time of the touch (ms). */
  at: number;
}

let touch: LastTouch | null = null;

/**
 * The last touch recorded by {@link installToastListeners}.
 * @returns The touch, or null.
 */
export function lastTouch(): LastTouch | null {
  return touch;
}

const TOUCHABLE =
  'button, a, [role="button"], input, summary, .btn, [data-step]';

/**
 * Document listeners of the bubble: remember every touch (app.js:534), and
 * hide the bubble on any touch outside it or any key (nav.js:23-24).
 * @returns Removes the listeners.
 */
export function installToastListeners(): () => void {
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', hideToast, true);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', hideToast, true);
  };
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  touch = {
    element: target?.closest(TOUCHABLE) ?? null,
    y: event.clientY,
    at: Date.now(),
  };
  if (target?.closest('#toast')) return;
  hideToast();
}
