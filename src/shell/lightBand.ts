/** How long a band found stays lit. */
const LIT_MS = 2500;
/** Three blinks, as the CSS animation `band-blink` runs them. */
const BLINK_MS = 2100;

/** A list still being read: its band is looked for this long. */
const WAIT_MS = 5000;
const EVERY_MS = 250;

/**
 * Bring the band of a record into view in its list, lit a moment, or
 * blinking three times; a list still being read is waited for a moment.
 * @param id - The id of its record.
 * @param blink - Blink three times instead of staying lit.
 */
export function lightBand(id: string, blink = false): void {
  const until = Date.now() + WAIT_MS;
  const look = () => {
    const band = [
      ...document.querySelectorAll<HTMLElement>('[data-sw-id], [data-band-id]'),
    ].find(
      (one) =>
        one.dataset.swId === id ||
        one.dataset.swId?.startsWith(`${id}#`) ||
        one.dataset.bandId === id,
    );
    if (!band) {
      if (Date.now() < until) setTimeout(look, EVERY_MS);
      return;
    }
    band.scrollIntoView({ block: 'center' });
    const lit = blink ? 'band-blink' : 'search-found';
    band.classList.add(lit);
    setTimeout(() => band.classList.remove(lit), blink ? BLINK_MS : LIT_MS);
  };
  setTimeout(look, 400);
}
