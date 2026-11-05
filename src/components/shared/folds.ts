import { signal } from '@preact/signals-react';

import { store } from '../../storage/store.ts';

/** Screens whose sections never fold (input forms, SOS), nav.js:382. */
export const FOLD_SKIP: readonly string[] = ['new', 'day', 'sheet', 'sos'];
/** Screens whose sections start open (rescue pages), nav.js:383. */
export const FOLD_OPEN_VIEWS: readonly string[] = ['sos', 'mob', 'soslogs'];

/** Folded state per `view|title` (`ldb.folds2`): 1 closed, 0 open. */
export const folds = signal<Readonly<Record<string, number>>>(
  store.get<Record<string, number>>('ldb.folds2', {}),
);

/**
 * Key of a section title (nav.js:385): the view and the first 60 characters.
 * @param view - Current view.
 * @param title - Title text (trimmed, before the arrow).
 * @returns The storage key.
 */
export function foldKey(view: string, title: string): string {
  return `${view}|${title.trim().slice(0, 60)}`;
}

/**
 * Whether a section is folded (nav.js:401-402): as stored, else closed except
 * on the rescue pages.
 * @param view - Current view.
 * @param title - Title text.
 * @returns `true` when folded.
 */
export function isFolded(view: string, title: string): boolean {
  const stored = folds.value[foldKey(view, title)];
  return stored === 1 || (stored == null && !FOLD_OPEN_VIEWS.includes(view));
}

/**
 * Fold or unfold a section and keep it (nav.js:406-413).
 * @param view - Current view.
 * @param title - Title text.
 * @param closed - New state.
 */
export function setFolded(view: string, title: string, closed: boolean): void {
  folds.value = { ...folds.value, [foldKey(view, title)]: closed ? 1 : 0 };
  try {
    localStorage.setItem('ldb.folds2', JSON.stringify(folds.value));
  } catch {
    // Storage blocked: the state lasts until the page is closed.
  }
}
