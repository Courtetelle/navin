/**
 * A list swiped hard up or down starts a synchronisation in the background,
 * quietly: the gesture of a sailor who wants the news of the other devices.
 * The map (moved with the finger) never counts.
 */

/** Fast enough: pixels per millisecond. */
const FLING_SPEED = 1.5;
/** Long enough: pixels. */
const FLING_DISTANCE = 120;
/** Mostly vertical: the vertical move at least this many times the side one. */
const VERTICAL = 2;
/** At most one round started this way this often. */
const QUIET_MS = 60_000;

/** Where a fling never counts: the maps, moved with the finger. */
const NOT_A_LIST = '.leaflet-container, canvas, input, textarea';

let start: { x: number; y: number; t: number } | null = null;
let last = 0;

/**
 * Whether a move of the finger is a hard swipe up or down.
 * @param dx - Side move, pixels.
 * @param dy - Vertical move, pixels.
 * @param ms - Time, milliseconds.
 * @returns Whether it is a fling.
 */
export function isFling(dx: number, dy: number, ms: number): boolean {
  const distance = Math.abs(dy);
  return (
    distance >= FLING_DISTANCE &&
    distance >= VERTICAL * Math.abs(dx) &&
    distance / Math.max(ms, 1) >= FLING_SPEED
  );
}

/**
 * Follow the touches of the whole app.
 * @param run - Starts the round (quiet, in the background).
 */
export function installFlingSync(run: () => void): void {
  document.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0];
      const target = event.target as Element | null;
      start =
        event.touches.length === 1 && touch && !target?.closest(NOT_A_LIST)
          ? { x: touch.clientX, y: touch.clientY, t: Date.now() }
          : null;
    },
    { passive: true, capture: true },
  );
  document.addEventListener(
    'touchend',
    (event) => {
      const touch = event.changedTouches[0];
      const from = start;
      start = null;
      if (!from || !touch) return;
      const now = Date.now();
      if (now - last < QUIET_MS) return;
      if (
        !isFling(touch.clientX - from.x, touch.clientY - from.y, now - from.t)
      ) {
        return;
      }
      last = now;
      run();
    },
    { passive: true, capture: true },
  );
}
