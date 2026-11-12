import { signal } from '@preact/signals-react';

import { state } from '../state/index.ts';

import { addNavigationListener, go } from './router.ts';
import { ROOTS } from './viewLists.ts';

/** A menu opened by its button, and where it was opened from. */
interface OpenMenu {
  root: string;
  from: { view: string; arg: unknown };
}

/** The menu being browsed: its button blinks in every page of it. */
export const openMenu = signal<OpenMenu | null>(null);

/**
 * The button of a menu (data, settings), the same rule for each: closed, it
 * opens the menu; inside a page of the menu, it goes back one step; on the
 * menu itself, back where the menu was opened from.
 * @param root - The view of the menu.
 * @param back - Goes one step back (the nav bar ◀).
 * @param open - Opens the menu (by default, `go(root)`).
 */
export function menuButtonPress(
  root: string,
  back: () => void,
  open: () => void = () => go(root),
): void {
  const view = state.view.currentView.value;
  const current = openMenu.peek();
  if (current?.root === root && view === root) {
    openMenu.value = null;
    go(current.from.view, current.from.arg);
    return;
  }
  if (current?.root === root) {
    back();
    return;
  }
  const from = { view, arg: state.view.viewArg.value };
  open();
  openMenu.value = { root, from };
}

/**
 * Whether the menu of a button is being browsed.
 * @param root - The view of the menu.
 * @returns Its button blinks.
 */
export function inMenu(root: string): boolean {
  return openMenu.value?.root === root;
}

// Another main screen (map, SOS, another menu) closes the menu browsed.
addNavigationListener(({ phase, to }) => {
  const current = openMenu.peek();
  if (phase !== 'after' || !current || to === current.root) return;
  if (ROOTS.includes(to) || to === 'settings') openMenu.value = null;
});
