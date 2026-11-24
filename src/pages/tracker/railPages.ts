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
export const PHONE_SIDEWAYS_QUERY =
  '(orientation: landscape) and (min-width: 560px) and (max-height: 520px)';

/** The packet of buttons shown (0 the first). */
export const railPage = signal(0);
/** The packet of white figures shown at the bottom (0 the first). */
export const dashPage = signal(0);

/** A move shorter than this is a touch, not a swipe (px). */
const SWIPE_PX = 40;
/** Past this the finger slides: no long press any more (px). */
const SLIDE_PX = 10;
/** The click that ends a swipe comes within this time (ms). */
const CLICK_AFTER_MS = 300;

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
 * How many buttons a packet holds, the layout of the screen: five upright,
 * as many as fit above SOS sideways, all of them otherwise.
 * @returns The size of a packet.
 */
export function railPacket(): number {
  if (matches(PORTRAIT_QUERY)) return 5;
  if (!matches(PHONE_SIDEWAYS_QUERY)) return RAIL_ORDER.length;
  const style = globalThis.getComputedStyle(document.documentElement);
  const height = Number.parseFloat(style.getPropertyValue('--rb-h'));
  const step = height + Number.parseFloat(style.getPropertyValue('--rb-gap'));
  const top = Number.parseFloat(style.getPropertyValue('--rb-top')) || 10;
  if (!(step > 0)) return 6;
  // SOS has its own place at the bottom, the same gap from the edge as the
  // top: the buttons that stand above it, a gap between each.
  const free = globalThis.innerHeight - 2 * top - height;
  return Math.max(1, Math.floor(free / step));
}

/**
 * The buttons in packets: SOS stays out of them sideways (its own place).
 * @returns The keys of each packet.
 */
export function railPackets(): RailKey[][] {
  const size = railPacket();
  const sideways = matches(PHONE_SIDEWAYS_QUERY);
  const upright = matches(PORTRAIT_QUERY);
  const keys = RAIL_ORDER.filter(
    (key) =>
      !(sideways && key === 'sos') &&
      !(upright && (key === 'data' || key === 'gear')),
  );
  const packets: RailKey[][] = [];
  for (let index = 0; index < keys.length; index += size) {
    packets.push(keys.slice(index, index + size));
  }
  return packets;
}

/**
 * Write where each button stands: its place in its packet (`--ri-<key>`)
 * and how many packets away from the one shown it is (`--rp-<key>`).
 */
export function placeRails(): void {
  const root = document.documentElement;
  const packets = railPackets();
  const page = Math.min(railPage.peek(), packets.length - 1);
  if (page !== railPage.peek()) railPage.value = page;
  root.dataset.railPages = String(packets.length);
  root.dataset.railPage = String(page);
  for (const [number, packet] of packets.entries()) {
    for (const [index, key] of packet.entries()) {
      root.style.setProperty(`--ri-${key}`, String(index));
      root.style.setProperty(`--rp-${key}`, String(number - page));
    }
  }
}

/**
 * Turn the packets of buttons by one.
 * @param by - `1` the next, `-1` the previous.
 * @returns Whether it turned.
 */
export function turnRails(by: number): boolean {
  const count = railPackets().length;
  const next = railPage.peek() + by;
  if (next < 0 || next >= count) return false;
  railPage.value = next;
  placeRails();
  return true;
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
 * (and on the figures everywhere), up and down sideways, a packet at a time.
 */
export function useRailSwipe(): void {
  useEffect(() => {
    placeRails();
    let start: {
      x: number;
      y: number;
      on: 'rails' | 'dash';
      target: Element;
      moved: boolean;
    } | null = null;
    const down = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest) return;
      if (target.closest('.trk-dash')) {
        start = {
          x: event.clientX,
          y: event.clientY,
          on: 'dash',
          target,
          moved: false,
        };
      } else if (target.closest(RAIL_TARGETS)) {
        start = {
          x: event.clientX,
          y: event.clientY,
          on: 'rails',
          target,
          moved: false,
        };
      } else {
        start = null;
      }
    };
    // A finger that slides is no long press: the button under it hears so
    // even when the finger has left it.
    const move = (event: PointerEvent) => {
      if (!start || start.moved) return;
      const far = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (far <= SLIDE_PX) return;
      start.moved = true;
      start.target.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true }),
      );
    };
    const up = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const on = start.on;
      start = null;
      const sideways = matches(PHONE_SIDEWAYS_QUERY);
      let turned = false;
      if (on === 'dash') {
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
          turned = turnDash(dx < 0 ? 1 : -1, DASH_PACKETS);
        }
      } else if (sideways) {
        if (Math.abs(dy) > SWIPE_PX && Math.abs(dy) > Math.abs(dx)) {
          turned = turnRails(dy < 0 ? 1 : -1);
        }
      } else if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
        turned = turnRails(dx < 0 ? 1 : -1);
      }
      if (turned) {
        // The touch was a swipe: the button under it does not act.
        event.stopPropagation();
        buzz();
        swallowClick();
      }
    };
    const cancel = (event: PointerEvent) => {
      // Not the one sent to the button above: the system took the touch.
      if (event.isTrusted) start = null;
    };
    const lists = [PORTRAIT_QUERY, PHONE_SIDEWAYS_QUERY].map(
      (query) => globalThis.matchMedia?.(query) ?? null,
    );
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
