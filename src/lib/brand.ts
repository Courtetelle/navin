/** Names always written the same way, even in capitals. */
const BRANDS = ['NavIn', 'LiveMétéo'] as const;

/**
 * Text in capitals, NavIn and LiveMétéo kept as they are written.
 * @param text - The text.
 * @returns The text in capitals.
 */
export function upperKeepBrands(text: string): string {
  let upper = text.toUpperCase();
  for (const brand of BRANDS) {
    upper = upper.replaceAll(brand.toUpperCase(), brand);
  }
  return upper;
}
