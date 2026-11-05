import ficheEn from './data/ficheEn.json' with { type: 'json' };
import ficheEs from './data/ficheEs.json' with { type: 'json' };
import ficheIt from './data/ficheIt.json' with { type: 'json' };
import ficheParts from './data/ficheParts.json' with { type: 'json' };
import uiFixed from './data/uiFixed.json' with { type: 'json' };
import uiPatterns from './data/uiPatterns.json' with { type: 'json' };

/** A language of the FR ⇄ other language button. */
export type OtherLanguage = 'en' | 'it' | 'es';

/** French or one of the other languages. */
export type Language = 'fr' | OtherLanguage;

/** Short names shown on the language button (nav.js:788). */
export const LANGUAGE_NAMES: Readonly<Record<OtherLanguage, string>> = {
  en: 'EN',
  it: 'IT',
  es: 'ES',
};

const LANGUAGE_INDEX: Readonly<Record<OtherLanguage, number>> = {
  en: 0,
  it: 1,
  es: 2,
};

const DICTIONARIES: Readonly<
  Record<OtherLanguage, Readonly<Record<string, string>>>
> = {
  en: ficheEn,
  it: ficheIt,
  es: ficheEs,
};

const FIXED = uiFixed as Readonly<Record<string, readonly string[]>>;

const PATTERNS: ReadonlyArray<readonly [RegExp, readonly string[]]> = (
  uiPatterns as Array<[string, string, string[]]>
).map(([source, flags, outputs]) => [new RegExp(source, flags), outputs]);

type PartEntry = readonly [string, string, string];
const PART_DATA = ficheParts as unknown as Record<OtherLanguage, PartEntry[]>;

const PARTS: Readonly<
  Record<OtherLanguage, ReadonlyArray<readonly [RegExp, string]>>
> = {
  en: compileParts(PART_DATA.en),
  it: compileParts(PART_DATA.it),
  es: compileParts(PART_DATA.es),
};

/**
 * Translate one French text as legacy translated one text node (nav.js:965,
 * `trText`): exact dictionary entry, else a fixed UI sentence or a UI pattern
 * with variable parts, else (help texts only) known sentence fragments. The
 * surrounding whitespace of the text is kept.
 * @param text - French text (one text node).
 * @param language - Target language.
 * @param help - The text is inside a help element (`.help`, `small.rule`, `.exp-note`, `.fiche-lock`).
 * @returns The translation, or null when nothing is known.
 */
export function translateText(
  text: string,
  language: OtherLanguage,
  help = false,
): string | null {
  const key = text.trim();
  if (!key) return null;
  const dictionary = DICTIONARIES[language];
  const known = dictionary[key];
  if (known != null) return text.replace(key, known);
  const ui = translateUiPart(key, language);
  if (ui != null) return text.replace(key, ui);
  if (!help) return null;
  let output = key;
  let hit = false;
  for (const [pattern, replacement] of PARTS[language]) {
    if (pattern.test(output)) {
      hit = true;
      output = output.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }
  return hit ? text.replace(key, output) : null;
}

/**
 * Translate a text, or keep it when nothing is known (what a text node shows).
 * @param text - French text.
 * @param language - Target language, `fr` keeps the text.
 * @param help - The text is a help text.
 * @returns The text to display.
 */
export function translateOrKeep(
  text: string,
  language: Language,
  help = false,
): string {
  if (language === 'fr') return text;
  return translateText(text, language, help) ?? text;
}

/**
 * Translate a bubble message (legacy `uiTr`, nav.js:986): each idea separated
 * by ` · ` is translated as a help text.
 * @param message - French message.
 * @param language - Target language, `fr` keeps the message.
 * @returns The message to show.
 */
export function translateMessage(message: string, language: Language): string {
  if (language === 'fr') return message;
  return message
    .split(' · ')
    .map((part) => translateText(part, language, true) ?? part)
    .join(' · ');
}

/**
 * Translate a placeholder (`PH:` entries of the dictionary, nav.js:981).
 * @param placeholder - French placeholder.
 * @param language - Target language.
 * @returns The placeholder to show.
 */
export function translatePlaceholder(
  placeholder: string,
  language: Language,
): string {
  if (language === 'fr') return placeholder;
  return DICTIONARIES[language][`PH:${placeholder}`] || placeholder;
}

function translateUiPart(key: string, language: OtherLanguage): string | null {
  const index = LANGUAGE_INDEX[language];
  const fixed = FIXED[key];
  if (fixed) return fixed[index] ?? null;
  for (const [pattern, outputs] of PATTERNS) {
    const match = key.match(pattern);
    if (!match) continue;
    const output = outputs[index] ?? '';
    return output.replaceAll(/\$(?<group>\d)/g, (_all, group: string) => {
      const part = match[Number(group)];
      return part == null ? '' : word(part, language);
    });
  }
  return null;
}

function word(text: string, language: OtherLanguage): string {
  const known = DICTIONARIES[language][text];
  if (known != null) return known;
  const fixed = FIXED[text];
  return fixed ? (fixed[LANGUAGE_INDEX[language]] ?? text) : text;
}

function compileParts(
  parts: readonly PartEntry[],
): Array<readonly [RegExp, string]> {
  return parts.map(([source, flags, replacement]) => [
    new RegExp(source, flags),
    replacement,
  ]);
}
