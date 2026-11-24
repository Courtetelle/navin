import { signal } from '@preact/signals-react';

import { state } from '../state/index.ts';

import { setBodyClass } from './bodyClass.ts';

/**
 * Routes, and upright data and Paramétrages, unrolled by their tab (at the
 * top in the middle sideways, at the right edge in the middle upright);
 * sideways data and Paramétrages stand under Météo since 24/11/2026.
 */
export const menusOpen = signal(false);

/** Left without a choice they stay fully shown this long… */
const SOLID_MS = 2000;
/** …then fade out over this long and roll back (the usual rule). */
const FADE_MS = 3000;

let idle: ReturnType<typeof setTimeout> | undefined;
let fade: ReturnType<typeof setTimeout> | undefined;
let watching = false;

function show(open: boolean): void {
  menusOpen.value = open;
  setBodyClass('menus-open', open);
  setBodyClass('menus-fading', false);
  clearTimeout(idle);
  clearTimeout(fade);
  if (!open) return;
  fade = setTimeout(() => setBodyClass('menus-fading', true), SOLID_MS);
  idle = setTimeout(() => show(false), SOLID_MS + FADE_MS);
}

function watch(): void {
  if (watching) return;
  watching = true;
  // One of the two chosen: they roll back at once, its menu shows.
  state.view.currentView.subscribe(() => {
    if (menusOpen.peek()) show(false);
  });
}

/**
 * The tab touched: data and Paramétrages unroll (touched again, they stay
 * 2 s more; no button rolls them back, they fade on their own).
 */
export function openMenus(): void {
  watch();
  show(true);
}

/** Roll them back now. */
export function closeMenus(): void {
  show(false);
}
