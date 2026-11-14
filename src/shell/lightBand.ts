/** How long a band found stays lit. */
const LIT_MS = 2500;
/** Three blinks, as the CSS animation `band-blink` runs them. */
const BLINK_MS = 2100;

/**
 * Bring the band of a record into view in its list, lit a moment, or
 * blinking three times.
 * @param id - The id of its record.
 * @param blink - Blink three times instead of staying lit.
 */
export function lightBand(id: string, blink = false): void {
  setTimeout(() => {
    const band = [
      ...document.querySelectorAll<HTMLElement>('[data-sw-id]'),
    ].find(
      (one) =>
        one.dataset.swId === id || one.dataset.swId?.startsWith(`${id}#`),
    );
    if (!band) return;
    band.scrollIntoView({ block: 'center' });
    const lit = blink ? 'band-blink' : 'search-found';
    band.classList.add(lit);
    setTimeout(() => band.classList.remove(lit), blink ? BLINK_MS : LIT_MS);
  }, 400);
}
