import { signal } from '@preact/signals-react';

import { state } from '../state/index.ts';

import { setBodyClass } from './bodyClass.ts';

/** The row of menus unrolled at the right of NavIn (landscape tablet). */
export const navinRowOpen = signal(false);

/** Left without a choice, the row stays fully shown this long… */
const SOLID_MS = 2000;
/** …then fades out over this long and rolls back, as ＋ and −. */
const FADE_MS = 3000;

let chosen = false;
let idle: ReturnType<typeof setTimeout> | undefined;
let fade: ReturnType<typeof setTimeout> | undefined;
let watching = false;

function show(open: boolean): void {
  navinRowOpen.value = open;
  setBodyClass('navin-open', open);
  setBodyClass('navin-fading', false);
  clearTimeout(idle);
  clearTimeout(fade);
  if (open && !chosen) {
    fade = setTimeout(() => {
      if (!chosen) setBodyClass('navin-fading', true);
    }, SOLID_MS);
    idle = setTimeout(() => {
      if (!chosen) closeNavinRow();
    }, SOLID_MS + FADE_MS);
  }
}

function watch(): void {
  if (watching) return;
  watching = true;
  // Back on the map after one of its menus: the whole row rolls back.
  state.view.currentView.subscribe((view) => {
    if (navinRowOpen.peek() && chosen && view === 'tracker') closeNavinRow();
  });
}

/** Unroll the row: PréP (Météo during a track), data, Réglages, phone or VHF. */
export function openNavinRow(): void {
  watch();
  chosen = false;
  show(true);
}

/** Roll the row back into NavIn. */
export function closeNavinRow(): void {
  chosen = false;
  show(false);
}

/** NavIn touched: the row unrolls, or rolls back. */
export function toggleNavinRow(): void {
  if (navinRowOpen.peek()) closeNavinRow();
  else openNavinRow();
}

/**
 * A menu of the row was chosen: the row rolls back at once, while the menu
 * chosen shows (after the touch has reached its button).
 */
export function navinRowChosen(): void {
  if (!navinRowOpen.peek()) return;
  chosen = true;
  clearTimeout(idle);
  clearTimeout(fade);
  setBodyClass('navin-fading', false);
  setTimeout(closeNavinRow, 0);
}
