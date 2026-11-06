import { useEffect } from 'react';

import { state } from '../state/index.ts';

import { setBodyClass } from './bodyClass.ts';
import { addNavigationListener } from './router.ts';
import { restoreSlides } from './slides.ts';

/**
 * On the tracker (`body.trk-mode`), the top bar and the bottom board are put away
 * by their chevron; a small handle with a chevron brings each back, by a tap.
 * The top bar comes back on every new screen; the board is out only while a
 * track records, unless opened by its handle.
 * @returns The two handles.
 */
export function SlideHandles() {
  useEffect(() => {
    const stop = addNavigationListener((event) => {
      if (event.phase === 'after') restoreSlides();
    });
    // The board comes out when a recording starts and folds when it ends.
    const stopFollowing = state.view.tracking.subscribe((tracking) => {
      setBodyClass('bot-hidden', !tracking);
    });
    return () => {
      stop();
      stopFollowing();
    };
  }, []);
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
