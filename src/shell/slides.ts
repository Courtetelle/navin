import { setBodyClass } from './bodyClass.ts';

/** Bring back the top bar and the bottom board (legacy restore on each render of `#view`). */
export function restoreSlides(): void {
  setBodyClass('top-hidden', false);
  setBodyClass('bot-hidden', false);
}
