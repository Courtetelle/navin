import { textOf } from './format.ts';
import { COLORS_EN, COLOR_EN_SET, DESC_PH } from './translateDictionary.ts';
import { DESC_NOUNS, DESC_WORDS } from './translateWords.ts';

const DESC_PHRASES: ReadonlyArray<readonly [RegExp, string]> = DESC_PH.map(
  ([french, english]) =>
    [
      new RegExp(`(^|[^0-9A-Za-zÀ-ÿ])${french}(?![0-9A-Za-zÀ-ÿ])`, 'gi'),
      `$1${english}`,
    ] as const,
);
const SHADES = new Set(['dark', 'light', 'bright', 'pale', 'neon']);
const COLOR_LIKE_WORDS = new Set([
  ...SHADES,
  'faded',
  'worn',
  'striped',
  'plain',
  'matt',
  'glossy',
  'metallic',
  'clear',
]);

interface Token {
  word: string;
  /** @default undefined */
  separator?: boolean;
  /** @default undefined */
  noun?: boolean;
  /** @default undefined */
  color?: boolean;
}

function lookup(table: Readonly<Record<string, string>>, key: string) {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

/**
 * Translate French colour words word by word (legacy `colorEn`).
 * @param text - French colours, e.g. `blanche et bleue`.
 * @returns The English words, other words kept.
 */
export function colorEn(text: unknown): string {
  const parts = textOf(text)
    .trim()
    .split(/(?<separator>\s+|,)/);
  let out = '';
  for (const part of parts) {
    out += lookup(COLORS_EN, part.toLowerCase()) || part;
  }
  return out;
}

/**
 * Colours in English order: the shade before the colour (legacy `colorEnOrder`).
 * @param text - French colours, e.g. `bleu marine`.
 * @returns e.g. `navy blue`.
 */
export function colorEnOrder(text: unknown): string {
  return colorEn(text)
    .replaceAll(
      /\b(?<color>blue) (?<shade>navy|dark|light|sky)\b/gi,
      '$<shade> $<color>',
    )
    .replaceAll(
      /\b(?<color>\w+) (?<shade>dark|light)\b/gi,
      '$<shade> $<color>',
    );
}

function tokenOf(word: string): Token {
  const lower = word.toLowerCase();
  if (/^\s+$|^[,;.()«»":]$/.test(word)) return { word, separator: true };
  const noun = lookup(DESC_NOUNS, lower);
  if (noun) return { word: noun, noun: true };
  const color = lookup(COLORS_EN, lower);
  if (color) return { word: color, color: true };
  const english = lookup(DESC_WORDS, lower);
  if (english !== undefined) {
    return { word: english, color: COLOR_LIKE_WORDS.has(english) };
  }
  return { word, color: COLOR_EN_SET.has(lower) };
}

/**
 * Offline French → English translation of a free description (hull, sails),
 * for radio and SOS texts (legacy `descEn`). Unknown words are kept.
 * @param text - French description, e.g. `bande bleue et blanche`.
 * @returns English description, e.g. `blue and white stripe`.
 */
export function descEn(text: unknown): string {
  let value = ` ${textOf(text).trim()} `;
  if (!value.trim()) return '';
  for (const [pattern, english] of DESC_PHRASES) {
    value = value.replace(pattern, english);
  }
  value = value.replaceAll(/\b(?<article>[ld])['’]/gi, '$<article> ');
  const words: Token[] = [];
  for (const part of value
    .trim()
    .split(/(?<separator>\s+|,|;|\.|\(|\)|«|»|"|:)/)) {
    if (part === '' || part === undefined) continue;
    const token = tokenOf(part);
    if (token.separator && !token.word.trim()) continue;
    if (token.word === '') continue;
    words.push(token);
  }
  for (let position = 0; position < words.length; position++) {
    if (!words[position]?.noun) continue;
    let next = position + 1;
    const colors: Token[] = [];
    while (
      next < words.length &&
      (words[next]?.color ||
        (words[next]?.word === 'and' &&
          next + 1 < words.length &&
          words[next + 1]?.color))
    ) {
      colors.push(words[next] as Token);
      next++;
    }
    if (colors.length > 0) {
      words.splice(
        position,
        colors.length + 1,
        ...colors,
        words[position] as Token,
      );
      position += colors.length;
    }
  }
  for (let position = 1; position < words.length; position++) {
    const current = words[position] as Token;
    const previous = words[position - 1] as Token;
    if (
      SHADES.has(current.word) &&
      previous.color &&
      !SHADES.has(previous.word)
    ) {
      words[position] = previous;
      words[position - 1] = current;
    }
  }
  let joined = '';
  for (let position = 0; position < words.length; position++) {
    joined += (position ? ' ' : '') + (words[position] as Token).word;
  }
  return joined
    .replaceAll(/\s+(?<mark>[,;.):»"])/g, '$<mark>')
    .replaceAll(/(?<mark>[(«"])\s+/g, '$<mark>')
    .replaceAll(/\s{2,}/g, ' ')
    .replaceAll(/\b(?<word>\w+) \k<word>\b/g, '$<word>')
    .trim();
}
