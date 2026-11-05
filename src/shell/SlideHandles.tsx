import { useEffect } from 'react';

import { hasBodyClass, setBodyClass } from './bodyClass.ts';
import { addNavigationListener } from './router.ts';
import { restoreSlides } from './slides.ts';

interface SlideStart {
  x: number;
  y: number;
  top: boolean;
  bottom: boolean;
  handle: 'top' | 'bottom' | null;
}

let start: SlideStart | null = null;
let swallow = false;

/**
 * On the tracker (`body.trk-mode`), slide the top bar up or the bottom board
 * down to clear the map; a small handle brings each back (legacy `slideAway`,
 * nav.js:1194-1219). Both come back on every new screen.
 * @returns The two handles.
 */
export function SlideHandles() {
  useEffect(() => {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('click', onClick, true);
    const stop = addNavigationListener((event) => {
      if (event.phase === 'after') restoreSlides();
    });
    return () => {
      stop();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
  return (
    <>
      <div
        id="hTop"
        className="slide-handle sh-top"
        role="button"
        aria-label="Rappeler"
      />
      <div
        id="hBot"
        className="slide-handle sh-bot"
        role="button"
        aria-label="Rappeler"
      />
    </>
  );
}

function onPointerDown(event: PointerEvent): void {
  const { target, clientX, clientY } = event;
  if (!hasBodyClass('trk-mode') || !(target instanceof Element)) return;
  const top = Boolean(target.closest('.topbar'));
  const bottom = Boolean(target.closest('#trkDash'));
  const handleElement = target.closest('.slide-handle');
  if (!top && !bottom && !handleElement) return;
  start = {
    x: clientX,
    y: clientY,
    top,
    bottom,
    handle: handleElement
      ? handleElement.id === 'hTop'
        ? 'top'
        : 'bottom'
      : null,
  };
}

function onPointerUp(event: PointerEvent): void {
  const begun = start;
  if (!begun) return;
  start = null;
  const dy = event.clientY - begun.y;
  const dx = Math.abs(event.clientX - begun.x);
  if (Math.abs(dy) < (begun.top ? 18 : 30) || dx > Math.abs(dy)) {
    if (begun.handle) {
      setBodyClass(begun.handle === 'top' ? 'top-hidden' : 'bot-hidden', false);
    }
    return;
  }
  if (begun.top && dy < 0) {
    setBodyClass('top-hidden', true);
    swallow = true;
  } else if (begun.bottom && dy > 0) {
    setBodyClass('bot-hidden', true);
    swallow = true;
  } else if (begun.handle === 'top' && dy > 0) {
    setBodyClass('top-hidden', false);
  } else if (begun.handle === 'bottom' && dy < 0) {
    setBodyClass('bot-hidden', false);
  }
  if (swallow) {
    setTimeout(() => {
      swallow = false;
    }, 400);
  }
}

function onClick(event: MouseEvent): void {
  if (!swallow) return;
  event.stopPropagation();
  event.preventDefault();
  swallow = false;
}
