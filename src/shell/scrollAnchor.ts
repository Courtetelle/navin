let holds = 0;

/**
 * Keep scrollY where it is until {@link release} is called, whatever the
 * browser's scroll anchoring would do with the elements that survive a render.
 * @returns The release function; calling it twice is harmless.
 */
export function suspendScrollAnchoring(): () => void {
  const root = document.documentElement.style;
  holds++;
  root.overflowAnchor = 'none';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds === 0) root.removeProperty('overflow-anchor');
  };
}

/** {@link suspendScrollAnchoring} until the next frame has been laid out. */
export function holdScrollAnchoring(): void {
  const release = suspendScrollAnchoring();
  requestAnimationFrame(() => setTimeout(release, 0));
}

/**
 * A tap redraws the screen in place (legacy `VIEWS.x()`): legacy rewrote all of
 * `#view`, so the browser had no element left to anchor on and scrollY stayed
 * put (clamped to the new height). React keeps the elements that survive, and
 * anchoring would make the page follow them. Folds are the exception: legacy
 * only toggled a class there, and anchoring applied.
 * @returns The function removing the listeners.
 */
export function installTapScrollHold(): () => void {
  document.addEventListener('click', onGesture, true);
  document.addEventListener('change', onGesture, true);
  return () => {
    document.removeEventListener('click', onGesture, true);
    document.removeEventListener('change', onGesture, true);
  };
}

function onGesture({ target }: Event): void {
  if (target instanceof Element && target.closest('summary, .fold-h')) return;
  holdScrollAnchoring();
}
