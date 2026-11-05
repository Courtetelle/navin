import { signal } from '@preact/signals-react';

/** Delay before an unanswered confirmation row closes (prep.js:1256). */
const CONFIRM_DELAY_MS = 5000;

/** Token of the row whose confirmation is open; only one at a time. */
export const openRowToken = signal<string | null>(null);

let closeTimer: ReturnType<typeof setTimeout> | undefined;

/** Close the confirmation row (legacy `closeRow`, prep.js:1227). */
export function closeSwipeRow(): void {
  clearTimeout(closeTimer);
  openRowToken.value = null;
}

/**
 * Open the confirmation row of a row, closing any other one.
 * @param token - Row token.
 */
export function openSwipeRow(token: string): void {
  clearTimeout(closeTimer);
  openRowToken.value = token;
  closeTimer = setTimeout(closeSwipeRow, CONFIRM_DELAY_MS);
}
