import { signal } from '@preact/signals-react';

import { state } from '../state/index.ts';

import { setBodyClass } from './bodyClass.ts';

/** The row of menus unrolled at the right of NavIn (landscape tablet). */
export const navinRowOpen = signal(false);

/** Left without a choice, the row rolls back after this long, as ＋ and −. */
const IDLE_MS = 3000;

let chosen = false;
let idle: ReturnType<typeof setTimeout> | undefined;
let watching = false;

function show(open: boolean): void {
  navinRowOpen.value = open;
  setBodyClass('navin-open', open);
  clearTimeout(idle);
  if (open && !chosen) {
    idle = setTimeout(() => {
      if (!chosen) closeNavinRow();
    }, IDLE_MS);
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
  setTimeout(closeNavinRow, 0);
}
