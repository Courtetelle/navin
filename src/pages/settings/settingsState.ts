import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import type { Settings } from '../../model/settings.ts';
import { state, updateSettings } from '../../state/index.ts';

/** Sections unfolded on screen. */
export const openSections = signal<ReadonlySet<string>>(new Set());
/** Increases at each redraw: the margin fields show the stored values again. */
export const settingsRedraws = signal(0);

/**
 * Prepare the sections when the screen opens: arriving from elsewhere, all are
 * closed; a redraw keeps the one opened last.
 * @param redrawn - The settings were already shown.
 */
export function enterSettings(redrawn: boolean): void {
  if (!redrawn) state.view.settingsOpen.value = null;
  redrawSettings();
}

/** Draw the page again (legacy `VIEWS.settings()`): only the section opened last stays open. */
export function redrawSettings(): void {
  const open = state.view.settingsOpen.peek();
  openSections.value = new Set(open ? [open] : []);
  settingsRedraws.value += 1;
}

/**
 * Follow a section folded or unfolded by the user.
 * @param section - Section key.
 * @param open - New state.
 */
export function noteSectionToggle(section: string, open: boolean): void {
  const { settingsOpen } = state.view;
  if (open) settingsOpen.value = section;
  else if (settingsOpen.peek() === section) settingsOpen.value = null;
  if (openSections.peek().has(section) === open) return;
  const next = new Set(openSections.peek());
  if (open) next.add(section);
  else next.delete(section);
  openSections.value = next;
}

/**
 * Change a setting from a button: vibrate, save, redraw.
 * @param recipe - Mutates the settings.
 */
export function changeSetting(recipe: (settings: Settings) => void): void {
  buzz();
  updateSettings(recipe);
  redrawSettings();
}
