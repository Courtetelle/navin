const rollEnds = new WeakMap<Element, number>();

/**
 * Scroll the text track of a button or a cut text once (legacy `uiRoll`,
 * ui-edit.js:116-127): the track moves by its overflow plus 24 px, at 40 px/s
 * (at least 2 s), through the CSS variables `--ue-shift` / `--ue-dur` and the
 * `rolling` class. The track is a `span.ue-track` the component renders with a
 * constant class, so these writes never conflict with React.
 * @param container - The button or text element holding `.ue-track`.
 * @param editing - The label edit mode is on (no rolling then).
 */
export function rollText(container: Element | null, editing = false): void {
  if (!container?.isConnected || editing) return;
  const track = container.querySelector<HTMLElement>('.ue-track');
  if (!track) return;
  const over = track.scrollWidth - container.clientWidth + 24;
  if (over <= 0) return;
  const duration = Math.max(2, over / 40);
  track.style.setProperty('--ue-shift', `-${over}px`);
  track.style.setProperty('--ue-dur', `${duration}s`);
  if (
    track.classList.contains('rolling') &&
    (rollEnds.get(track) ?? 0) > Date.now()
  ) {
    return;
  }
  rollEnds.set(track, Date.now() + duration * 1000);
  track.classList.remove('rolling');
  // Reading the width between the two writes restarts the CSS animation.
  if (track.offsetWidth >= 0) track.classList.add('rolling');
}
