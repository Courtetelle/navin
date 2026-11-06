import { useEffect } from 'react';

import { setBodyClass } from './bodyClass.ts';
import { addNavigationListener } from './router.ts';
import { restoreSlides } from './slides.ts';

/**
 * On the tracker (`body.trk-mode`), the top bar and the bottom board are put away
 * by their chevron; a small handle with a chevron brings each back, by a tap.
 * Both come back on every new screen.
 * @returns The two handles.
 */
export function SlideHandles() {
  useEffect(
    () =>
      addNavigationListener((event) => {
        if (event.phase === 'after') restoreSlides();
      }),
    [],
  );
  return (
    <>
      <button
        type="button"
        id="hTop"
        className="slide-handle sh-top"
        aria-label="Rappeler le bandeau"
        onClick={() => setBodyClass('top-hidden', false)}
      />
      <button
        type="button"
        id="hBot"
        className="slide-handle sh-bot"
        aria-label="Rappeler le tableau de bord"
        onClick={() => setBodyClass('bot-hidden', false)}
      />
    </>
  );
}
