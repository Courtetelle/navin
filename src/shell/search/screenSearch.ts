import { matches, plain } from './searchIndex.ts';

/** A place of the screen that holds words: a band, a field, a line. */
export interface ScreenSpot {
  element: HTMLElement;
  /** Its words, the values typed in its fields included. */
  text: string;
}

/** A band of a list, a field with its title, a row: found as a whole. */
const WHOLE = '[data-sw-id], [data-band-id], .cf, tr';
/** The other places of a screen, the smallest that hold words. */
const BLOCKS = [
  'details > summary',
  'li',
  'p',
  'h2',
  'h3',
  'h4',
  'button',
  'a[href]',
  'label',
  'small.help',
].join(', ');

/** Longest text shown for a place found. */
const SHOWN = 60;

/**
 * Every place of the screen that holds words (in a folded section too).
 * @param root - The screen (`<main id="view">`).
 * @returns The places, in the order of the screen.
 */
export function screenSpots(
  root: ParentNode | null = document.querySelector('#view'),
): ScreenSpot[] {
  if (!root) return [];
  const spots: ScreenSpot[] = [];
  const seen = new Set<Element>();
  for (const element of root.querySelectorAll<HTMLElement>(
    `${WHOLE}, ${BLOCKS}`,
  )) {
    if (element.closest('[hidden], .no-search')) continue;
    const whole = element.closest<HTMLElement>(WHOLE);
    if (whole) {
      if (seen.has(whole)) continue;
      seen.add(whole);
      const text = spotText(whole);
      if (text) spots.push({ element: whole, text });
      continue;
    }
    // The smallest place: a block holding another one gives way to it.
    if (element.querySelector(BLOCKS)) continue;
    const text = spotText(element);
    if (text) spots.push({ element, text });
  }
  return spots;
}

/**
 * The words of a place: its text and what is typed in its fields.
 * @param element - The place.
 * @returns One line.
 */
export function spotText(element: Element): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text) parts.push(text);
  }
  for (const field of element.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('input, textarea, select')) {
    const value =
      field instanceof HTMLSelectElement
        ? (field.selectedOptions[0]?.textContent ?? '')
        : ['checkbox', 'radio', 'button'].includes(field.type)
          ? ''
          : field.value;
    // A value also written beside its field is said once.
    if (value.trim() && !parts.includes(value.trim())) parts.push(value.trim());
  }
  return parts.join(' ').replaceAll(/\s+/g, ' ').trim();
}

/**
 * The places of the screen holding every word typed.
 * @param query - Words typed.
 * @param spots - The places of the screen.
 * @returns The places found, each with the words around the first one.
 */
export function screenFound(
  query: string,
  spots: readonly ScreenSpot[],
): Array<{ spot: ScreenSpot; label: string }> {
  const first = plain(query).split(/\s+/).find(Boolean) ?? '';
  return matches(query, spots, (spot) => spot.text).map((spot) => ({
    spot,
    label: around(spot.text, first),
  }));
}

/**
 * The words of a text around a word, at most {@link SHOWN} letters.
 * @param text - The text.
 * @param word - The word, plain.
 * @returns e.g. `…Windy · www.windy.com…`.
 */
function around(text: string, word: string): string {
  if (text.length <= SHOWN) return text;
  const at = Math.max(0, plain(text).indexOf(word));
  const from = Math.max(0, Math.min(at - 15, text.length - SHOWN));
  const part = text.slice(from, from + SHOWN).trim();
  return `${from > 0 ? '…' : ''}${part}${from + SHOWN < text.length ? '…' : ''}`;
}

/** How long a place found stays lit. */
const LIT_MS = 2500;

/**
 * Show a place found: its folded sections open, brought into view, lit a
 * moment.
 * @param element - The place.
 */
export function showSpot(element: HTMLElement): void {
  for (
    let fold = element.closest('details');
    fold;
    fold = fold.parentElement?.closest('details') ?? null
  ) {
    fold.open = true;
  }
  element.scrollIntoView({ block: 'center' });
  element.classList.add('search-spot');
  setTimeout(() => element.classList.remove('search-spot'), LIT_MS);
}
