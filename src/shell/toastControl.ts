import { signal } from '@preact/signals-react';

/** What the `#toast` element shows: legacy keeps the last text even once hidden. */
interface ToastDisplay {
  /** Text with one idea per line. */
  text: string;
  /** The bubble is visible (legacy class `show`). */
  shown: boolean;
  /** Moved under the top bar so it does not cover the button just touched. */
  top: boolean;
  /** Reading time of the current text, in milliseconds. */
  duration: number;
}

/** Display state of the bubble, written by the shell only. */
export const toastDisplay = signal<ToastDisplay>({
  text: '',
  shown: false,
  top: false,
  duration: 3000,
});

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Reading time of a bubble (app.js:553-554): 0.3 s per word plus 1.5 s,
 * between 2.5 s and 25 s.
 * @param message - Text shown (after translation).
 * @returns Duration in milliseconds.
 */
export function toastDuration(message: string): number {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2500, Math.min(25_000, 1500 + words * 300));
}

/**
 * One idea per line: the ` · ` separators become line breaks (app.js:547).
 * @param message - Text of the bubble.
 * @returns Text to display.
 */
export function toastLines(message: string): string {
  return message.replaceAll(' · ', '\n');
}

/**
 * Show a text in the bubble and start its timer.
 * @param text - Text with line breaks.
 * @param duration - Milliseconds before it hides.
 * @param top - Show it under the top bar.
 */
export function showToastText(
  text: string,
  duration: number,
  top: boolean,
): void {
  toastDisplay.value = { text, shown: true, top, duration };
  restartToastTimer(duration);
}

/**
 * Restart the hide timer of the visible bubble.
 * @param duration - Milliseconds before it hides.
 */
export function restartToastTimer(duration: number): void {
  stopToastTimer();
  timer = setTimeout(hideToast, duration);
}

/** Stop the hide timer (the bubble is being dragged). */
export function stopToastTimer(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

/** Hide the bubble, keeping its text (legacy `hideToast`, nav.js:20). */
export function hideToast(): void {
  stopToastTimer();
  if (!toastDisplay.value.shown) return;
  toastDisplay.value = { ...toastDisplay.value, shown: false };
}

/**
 * Change the "under the top bar" placement of the current bubble.
 * @param top - New placement.
 */
export function setToastTop(top: boolean): void {
  if (toastDisplay.value.top === top) return;
  toastDisplay.value = { ...toastDisplay.value, top };
}
