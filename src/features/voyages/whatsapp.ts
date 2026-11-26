/**
 * A WhatsApp conversation with a number written in full, « +33 6 23 82 11 68 »
 * or « 0033… » (a local number, without its country, cannot be reached).
 * @param value - The number as typed.
 * @returns The `wa.me` link, or `null`.
 */
export function whatsappHref(value: string): string | null {
  const plain = value.trim().replace(/^00/u, '+');
  if (!plain.startsWith('+')) return null;
  const digits = plain.replaceAll(/\D/gu, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}
