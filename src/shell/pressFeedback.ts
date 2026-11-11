/**
 * The buttons of the tablet columns and of the map show how they were
 * pressed: held down while the finger is on them, then a short press stays
 * pressed in a moment, a long press deeper and lit a little longer.
 */

/** The buttons that show their press. */
export const PRESS_TARGETS = [
  '.rail-btn',
  '#gearBtn',
  '#searchBtn',
  'header.topbar nav.topnav .top-tab',
  'header.topbar #clock',
  '.trk-full .leaflet-control-container .leaflet-bar a',
  '.trk-full .leaflet-control-container a.map-full-btn',
  '.trk-full .leaflet-control-layers-toggle',
].join(',');

/** From this long, a press is a long one (as useLongPress). */
export const LONG_MS = 550;
const SHORT_SHOWN_MS = 600;
const LONG_SHOWN_MS = 900;
/** A finger moved this far is a drag, not a press. */
const MOVE_PX = 12;

/**
 * The kind of a press.
 * @param heldMs - How long the finger stayed.
 * @returns `short` or `long`.
 */
export function pressKind(heldMs: number): 'short' | 'long' {
  return heldMs >= LONG_MS ? 'long' : 'short';
}

interface Down {
  element: HTMLElement;
  at: number;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout>;
}

let down: Down | null = null;
const clearers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Shown as `data-press`: React leaves it alone when it draws the button again. */
type PressState = 'down' | 'held' | 'short' | 'long';

function mark(element: HTMLElement, value: PressState | null): void {
  if (value) element.dataset.press = value;
  else delete element.dataset.press;
}

function show(element: HTMLElement, kind: 'short' | 'long'): void {
  const before = clearers.get(element);
  if (before) clearTimeout(before);
  mark(element, kind);
  clearers.set(
    element,
    setTimeout(
      () => {
        if (element.dataset.press === kind) mark(element, null);
      },
      kind === 'long' ? LONG_SHOWN_MS : SHORT_SHOWN_MS,
    ),
  );
}

function release(done: boolean): void {
  if (!down) return;
  const { element, at, timer } = down;
  clearTimeout(timer);
  down = null;
  if (done) show(element, pressKind(Date.now() - at));
  else mark(element, null);
}

/** Follow the presses on the buttons, once, for the whole app. */
export function installPressFeedback(): void {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Element | null;
      const element = target?.closest<HTMLElement>(PRESS_TARGETS);
      if (!element) return;
      release(false);
      const before = clearers.get(element);
      if (before) clearTimeout(before);
      mark(element, 'down');
      down = {
        element,
        at: Date.now(),
        x: event.clientX,
        y: event.clientY,
        // Held long enough: the button says so before the finger lifts.
        timer: setTimeout(() => mark(element, 'held'), LONG_MS),
      };
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointermove',
    (event) => {
      if (!down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      if (moved > MOVE_PX) release(false);
    },
    { capture: true, passive: true },
  );
  document.addEventListener('pointerup', () => release(true), {
    capture: true,
    passive: true,
  });
  document.addEventListener('pointercancel', () => release(false), {
    capture: true,
    passive: true,
  });
}
