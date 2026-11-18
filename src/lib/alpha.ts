/**
 * Alphabetical order of titles, the emoji and signs in front left out:
 * « 🧭 Zone » is sorted at Z, « Équipages » with E.
 * @param first - A title.
 * @param second - Another title.
 * @returns Negative, zero or positive, for `Array.sort`.
 */
export function byAlpha(first: string, second: string): number {
  return alphaKey(first).localeCompare(alphaKey(second), 'fr', {
    sensitivity: 'base',
    numeric: true,
  });
}

/**
 * The words of a title, without what stands before its first letter.
 * @param title - The title.
 * @returns e.g. `Zone et écran`.
 */
export function alphaKey(title: string): string {
  return title.replace(/^[^\p{L}\p{N}]+/u, '');
}
