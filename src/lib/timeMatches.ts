/**
 * Times of day as NavIn writes them: `14:30`, `14:30:05`, `14h30`, each
 * maybe followed by « UTC », and the hours in words followed by « UTC »,
 * `14 h UTC`, `14 h 30 UTC` (without « UTC » they read like durations,
 * `1 h 05`, and are left alone).
 */
const TIME =
  /(?<![\p{L}\p{N}:.,/'])(?:[01]?\d|2[0-3])(?::[0-5]\d(?::[0-5]\d)?|h[0-5]\d)(?: ?UTC\b|(?![\p{L}\p{N}:]))|(?<![\p{L}\p{N}:.,/'])(?:[01]?\d|2[0-3]) h(?: [0-5]\d)? UTC\b/gu;

/** A text that may hold a time (a quick test before the full search). */
const MAYBE = /\d[:h ]\d|\d h /u;

/**
 * Where the times of day are in a text.
 * @param text - Any text shown.
 * @returns Start and end offsets of each time.
 */
export function timeSpans(text: string): Array<[start: number, end: number]> {
  if (!MAYBE.test(text)) return [];
  const spans: Array<[number, number]> = [];
  for (const match of text.matchAll(TIME)) {
    spans.push([match.index, match.index + match[0].length]);
  }
  return spans;
}
