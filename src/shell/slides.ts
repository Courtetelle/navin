import { state } from '../state/index.ts';

import { setBodyClass } from './bodyClass.ts';

/**
 * Bring back the top bar, and leave the bottom board out only while a track
 * records: otherwise it stays folded, its handle opens it.
 */
export function restoreSlides(): void {
  setBodyClass('top-hidden', false);
  setBodyClass('bot-hidden', !state.view.tracking.peek());
}
