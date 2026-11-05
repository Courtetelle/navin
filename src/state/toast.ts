import { view } from './view.ts';

let toastCounter = 0;

/**
 * Show a bubble (legacy `toast`). The shell renders `state.view.toast`, applies
 * the translation, the "one idea per line" split and the reading-time timer.
 * @param message - Text of the bubble.
 * @param force - Legacy second argument (kept for callers; bubbles always show).
 */
export function toast(message: string, force = false): void {
  toastCounter += 1;
  view.toast.value = { message, force, id: toastCounter };
}

/** Hide the current bubble. */
export function clearToast(): void {
  view.toast.value = null;
}
