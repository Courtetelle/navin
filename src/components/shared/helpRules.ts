/** Empty-state openings that always stay visible (nav.js:1125). */
const EMPTY_START = /^(?:Aucun|Aucune|No |Nessun|Ningún|Ninguna)/;
const EMPTY_SPLIT =
  /^(?<first>(?:Aucun|Aucune|No |Nessun|Ningún|Ninguna)[^.!?]*[.!?])\s+(?<rest>.{20,})$/s;

/** Facts about a help element that legacy `helpToPopup` read from the DOM. */
export interface HelpContext {
  /**
   * The element has an `id`, is inside `#offState`, `.keep-help`, `.toast` or
   * `.nav-pop`, or contains an input, button, select, textarea, link, image or canvas.
   * @default false
   */
  keep?: boolean;
  /**
   * The next sibling is a `.row` or `.set-rows`.
   * @default false
   */
  nextIsRow?: boolean;
}

/**
 * Whether a help text stays visible as is (legacy `keep`, nav.js:1125): short
 * (< 38 characters, or < 80 just above a row of buttons), empty-state messages,
 * or flagged by the context.
 * @param text - Plain text of the element (French, as rendered before translation).
 * @param context - DOM facts.
 * @returns `true` to keep the paragraph, `false` to turn it into an ⓘ pill.
 */
export function keepHelp(text: string, context: HelpContext = {}): boolean {
  if (context.keep) return true;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 38) return true;
  if (trimmed.length < 80 && context.nextIsRow) return true;
  return EMPTY_START.test(trimmed);
}

/**
 * An empty-state message followed by an explanation (nav.js:1131): the first
 * sentence stays as its own paragraph, the explanation goes behind the pill.
 * @param text - Plain text of a `p.help` without interactive children.
 * @returns The two parts, or null when the text is not of that kind.
 */
export function splitEmptyHelp(
  text: string,
): { first: string; rest: string } | null {
  const match = EMPTY_SPLIT.exec(text.trim());
  if (!match?.groups) return null;
  return { first: match.groups.first ?? '', rest: match.groups.rest ?? '' };
}

/**
 * Text shown in the bubble when the pill is touched (nav.js:1148): list items
 * joined by ` · `, else the text with its whitespace collapsed.
 * @param text - Text, or the list items.
 * @returns The bubble text.
 */
export function helpBubbleText(text: string | readonly string[]): string {
  if (typeof text === 'string') return text.trim().replaceAll(/\s+/g, ' ');
  const parts: string[] = [];
  for (const item of text) parts.push(item.trim());
  return parts.join(' · ');
}
