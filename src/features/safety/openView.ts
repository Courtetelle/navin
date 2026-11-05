import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';

/**
 * Open a screen from a button, with the usual vibration.
 * @param view - Screen name.
 * @param arg - Screen argument.
 */
export function openView(view: string, arg: string | null = null): void {
  buzz();
  go(view, arg);
}
