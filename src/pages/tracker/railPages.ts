import { signal } from '@preact/signals-react';
import { useEffect } from 'react';

import { buzz } from '../../lib/dom.ts';

/**
 * The buttons around the map, in their order: the five of the top row, then
 * the five that stood in the bottom row, data and Paramétrages under Météo
 * in the columns of landscape (Corban, 24/11/2026), SOS last. Upright they
 * stay behind their tab.
 */
export const RAIL_ORDER = [
  'clock',
  'boat',
  'start',
  'routes',
  'pin',
  'ruler',
  'search',
  'navin',
  'photo',
  'weather',
  'data',
  'gear',
  'sos',
] as const;

/** One of {@link RAIL_ORDER}. */
export type RailKey = (typeof RAIL_ORDER)[number];

/** The phone held upright: the buttons in one row, five at a time. */
export const PORTRAIT_QUERY = '(orientation: portrait)';
/** The phone sideways: the buttons in one column on the left, SOS at its foot. */
/** The tablet sideways (X): one column, turned when it does not fit. */
export const TABLET_SIDEWAYS_QUERY =
  '(orientation: landscape) and (min-width: 560px) and (min-height: 640px)';
export const PHONE_SIDEWAYS_QUERY =
  '(orientation: landscape) and (min-width: 560px) and (max-height: 520px)';

/** The first button shown, its rank among those that turn (0 the first). */
export const railStart = signal(0);
/** The packet of white figures shown at the bottom (0 the first). */
export const dashPage = signal(0);

/** A move shorter than this is a touch, not a swipe (px). */
const SWIPE_PX = 40;
/** Past this the finger slides: no long press any more (px). */
const SLIDE_PX = 10;
/** The click that ends a swipe comes within this time (ms). */
const CLICK_AFTER_MS = 300;
/** A swipe quicker than this is a big swipe: five buttons at once (ms). */
const FLICK_MS = 280;
/** Buttons a big swipe turns (Corban, 24/11/2026). */
export const FLICK_BUTTONS = 5;

/** The buttons of the rails, what a swipe on them turns. */
const RAIL_TARGETS = [
  '.side-rail',
  '#clock',
  '#searchBtn',
  '.top-tab[data-view="tracker"]',
  '.top-tab.tab-data',
  '#gearBtn',
  '.top-tab.tab-sos',
  '.rail-btn',
].join(', ');

function matches(query: string): boolean {
  return globalThis.matchMedia?.(query).matches ?? false;
}

/**
 * How many buttons are shown at once, the layout of the screen: five
 * upright, as many as fit above SOS sideways, all of them otherwise.
 * @returns How many.
 */
export function railPacket(): number {
  if (matches(PORTRAIT_QUERY)) return 5;
  const tablet = matches(TABLET_SIDEWAYS_QUERY);
  if (!tablet && !matches(PHONE_SIDEWAYS_QUERY)) return RAIL_ORDER.length;
  const style = globalThis.getComputedStyle(document.documentElement);
  const height = Number.parseFloat(style.getPropertyValue('--rb-h'));
  const step = height + Number.parseFloat(style.getPropertyValue('--rb-gap'));
  const top = Number.parseFloat(style.getPropertyValue('--rb-top')) || 10;
  if (!(step > 0)) return 6;
  // SOS has its own place at the bottom, the same gap from the edge as the
  // top: the buttons that stand above it, a gap between each.
  const free = globalThis.innerHeight - 2 * top - height;
  const fit = Math.max(1, Math.floor(free / step));
  // X: all of them when they fit, else turned as the phone sideways.
  return tablet ? Math.min(fit, railKeys().length) : fit;
}

/**
 * The buttons that turn, in their order: SOS stays out of them sideways (its
 * own place), data and Paramétrages upright (their tab).
 * @returns Their keys.
 */
export function railKeys(): RailKey[] {
  const tablet = matches(TABLET_SIDEWAYS_QUERY);
  const sideways = tablet || matches(PHONE_SIDEWAYS_QUERY);
  const upright = matches(PORTRAIT_QUERY);
  // Routes stands in the column on X only; SOS stays at the foot sideways.
  return RAIL_ORDER.filter(
    (key) =>
      !(sideways && key === 'sos') &&
      !(!tablet && key === 'routes') &&
      !(upright && (key === 'data' || key === 'gear')),
  );
}

/**
 * The places of the buttons when the first shown is `start`: its rank in
 * the window (`index`) and whether it stands before it (-1), in it (0) or
 * after it (1).
 * @param count - How many buttons turn.
 * @param size - How many are shown at once.
 * @param start - The first shown, wanted.
 * @returns The first shown (kept between 0 and the last window) and each
 *   place, by rank.
 */
export function railWindow(
  count: number,
  size: number,
  start: number,
): { start: number; places: Array<{ index: number; away: -1 | 0 | 1 }> } {
  const first = Math.max(0, Math.min(start, count - size));
  const places = Array.from({ length: count }, (_, rank) => {
    const index = rank - first;
    if (index < 0) return { index: index + size, away: -1 as const };
    if (index >= size) return { index: index - size, away: 1 as const };
    return { index, away: 0 as const };
  });
  return { start: first, places };
}

/**
 * Write where each button stands: its place in the window shown
 * (`--ri-<key>`) and whether it is before it, in it or after it
 * (`--rp-<key>`).
 */
export function placeRails(): void {
  const root = document.documentElement;
  const keys = railKeys();
  const size = railPacket();
  const { start, places } = railWindow(keys.length, size, railStart.peek());
  if (start !== railStart.peek()) railStart.value = start;
  root.dataset.railStart = String(start);
  root.dataset.railMore = String(Math.max(0, keys.length - size - start));
  for (const [rank, key] of keys.entries()) {
    const place = places[rank];
    if (!place) continue;
    root.style.setProperty(`--ri-${key}`, String(place.index));
    root.style.setProperty(`--rp-${key}`, String(place.away));
  }
}

/**
 * Turn the buttons by some places.
 * @param by - Positive: the next ones, negative: the previous ones.
 * @returns Whether it turned.
 */
export function turnRails(by: number): boolean {
  const keys = railKeys();
  const { start } = railWindow(
    keys.length,
    railPacket(),
    railStart.peek() + by,
  );
  if (start === railStart.peek()) return false;
  railStart.value = start;
  placeRails();
  return true;
}

/** The distance from one button to the next along the rails (px). */
function railStepPx(sideways: boolean): number {
  const style = globalThis.getComputedStyle(document.documentElement);
  const gap = Number.parseFloat(style.getPropertyValue('--rb-gap')) || 6;
  const box = document.querySelector('#clock')?.getBoundingClientRect();
  const size = sideways ? box?.height : box?.width;
  return size && size > 0 ? size + gap : 56;
}

/**
 * Turn the packets of white figures by one.
 * @param by - `1` the next, `-1` the previous.
 * @param count - How many packets there are.
 * @returns Whether it turned.
 */
export function turnDash(by: number, count: number): boolean {
  const next = dashPage.peek() + by;
  if (next < 0 || next >= count) return false;
  dashPage.value = next;
  return true;
}

/** How many packets of white figures the dashboard has. */
export const DASH_PACKETS = 2;

/** The column turns up and down (sideways), the row left and right. */
function vertical(): boolean {
  return matches(PHONE_SIDEWAYS_QUERY) || matches(TABLET_SIDEWAYS_QUERY);
}

/**
 * How many buttons a flick turns: the faster the finger, the more.
 * @param speed - Pixels per millisecond.
 * @returns From one to {@link FLICK_BUTTONS}.
 */
export function flickButtons(speed: number): number {
  return Math.max(1, Math.min(FLICK_BUTTONS, Math.round(speed * 2.5)));
}

function swallow(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}

/** Swallow the click that ends a swipe, once. */
function swallowClick(): void {
  document.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(
    () => document.removeEventListener('click', swallow, { capture: true }),
    CLICK_AFTER_MS,
  );
}

/**
 * The swipes on the buttons and on the white figures: left and right upright
 * (and on the figures everywhere), up and down sideways. On the buttons a
 * big quick swipe turns them five at a time, a finger that slides turns
 * them one by one as it goes; the figures turn a packet at a time.
 */
export function useRailSwipe(): void {
  useEffect(() => {
    placeRails();
    let start: {
      x: number;
      y: number;
      at: number;
      on: 'rails' | 'dash';
      target: Element;
      moved: boolean;
      first: number;
      turned: boolean;
    } | null = null;
    const down = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest) return;
      const on = target.closest('.trk-dash')
        ? 'dash'
        : target.closest(RAIL_TARGETS)
          ? 'rails'
          : null;
      start = on
        ? {
            x: event.clientX,
            y: event.clientY,
            at: event.timeStamp,
            on,
            target,
            moved: false,
            first: railStart.peek(),
            turned: false,
          }
        : null;
    };
    // A finger that slides is no long press: the button under it hears so
    // even when the finger has left it. On the buttons it turns them one
    // by one as it slides (Corban, 24/11/2026).
    const move = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!start.moved) {
        if (Math.hypot(dx, dy) <= SLIDE_PX) return;
        start.moved = true;
        start.target.dispatchEvent(
          new PointerEvent('pointercancel', { bubbles: true }),
        );
      }
      if (start.on !== 'rails') return;
      const sideways = vertical();
      const along = sideways ? dy : dx;
      const across = sideways ? dx : dy;
      if (Math.abs(along) <= Math.abs(across)) return;
      const steps = Math.trunc(-along / railStepPx(sideways));
      const wanted = start.first + steps;
      if (wanted === railStart.peek()) return;
      if (turnRails(wanted - railStart.peek())) {
        start.turned = true;
        buzz();
      }
    };
    const up = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const { on, first, at } = start;
      let turned = start.turned;
      start = null;
      const sideways = vertical();
      if (on === 'dash') {
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
          turned = turnDash(dx < 0 ? 1 : -1, DASH_PACKETS);
          if (turned) buzz();
        }
      } else {
        const along = sideways ? dy : dx;
        const across = sideways ? dx : dy;
        const quick = event.timeStamp - at < FLICK_MS;
        if (
          quick &&
          Math.abs(along) > SWIPE_PX &&
          Math.abs(along) > Math.abs(across)
        ) {
          // A flick: the faster the finger, the more buttons (one at
          // least, five at most) from where the finger came down.
          // Upright, a whole packet of five.
          const count = sideways
            ? flickButtons(Math.abs(along) / Math.max(1, event.timeStamp - at))
            : FLICK_BUTTONS;
          const by = along < 0 ? count : -count;
          if (turnRails(first + by - railStart.peek())) buzz();
          turned = turned || railStart.peek() !== first;
        }
      }
      if (turned) {
        // The touch was a swipe: the button under it does not act.
        event.stopPropagation();
        swallowClick();
      }
    };
    const cancel = (event: PointerEvent) => {
      // Not the one sent to the button above: the system took the touch.
      if (event.isTrusted) start = null;
    };
    const lists = [
      PORTRAIT_QUERY,
      PHONE_SIDEWAYS_QUERY,
      TABLET_SIDEWAYS_QUERY,
    ].map((query) => globalThis.matchMedia?.(query) ?? null);
    for (const list of lists) list?.addEventListener('change', placeRails);
    globalThis.addEventListener('resize', placeRails);
    document.addEventListener('pointerdown', down, { capture: true });
    document.addEventListener('pointermove', move, { capture: true });
    document.addEventListener('pointerup', up, { capture: true });
    document.addEventListener('pointercancel', cancel, { capture: true });
    return () => {
      for (const list of lists) list?.removeEventListener('change', placeRails);
      globalThis.removeEventListener('resize', placeRails);
      document.removeEventListener('pointerdown', down, { capture: true });
      document.removeEventListener('pointermove', move, { capture: true });
      document.removeEventListener('pointerup', up, { capture: true });
      document.removeEventListener('pointercancel', cancel, { capture: true });
    };
  }, []);
}
