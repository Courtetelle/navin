import { toast } from '../../state/index.ts';

/**
 * Show a bubble, then redraw the screen: the bubble places itself around the
 * button just touched, which the redraw replaces.
 * @param message - Text of the bubble.
 * @param redraw - Redraws the screen.
 */
export function toastThenRedraw(message: string, redraw: () => void): void {
  toast(message);
  queueMicrotask(redraw);
}
