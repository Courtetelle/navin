import { frN, num, textOf } from './format.ts';
import { colorEnOrder, descEn } from './translate.ts';
import { SAIL_COLORS, SAIL_EN } from './translateDictionary.ts';

/** Loose record of boat sheet values. */
type Values = Record<string, unknown>;

const text = (value: unknown) => textOf(value).trim();

/**
 * CSS background of a sail colour (legacy `sailColCss`).
 * @param color - French colour name.
 * @returns The CSS colour, `'transparent'` when unknown.
 */
export function sailColCss(color: unknown): string {
  const found = SAIL_COLORS.find(([name]) => name === color);
  return found ? found[1] : 'transparent';
}

/**
 * Colour and description joined by a comma (legacy `sailJoin`).
 * @param color - Colour.
 * @param description - Description.
 * @returns The joined text.
 */
function sailJoin(color: unknown, description: unknown): string {
  return [color, description]
    .map((part) => text(part))
    .filter(Boolean)
    .join(', ');
}

/**
 * French and English lines shown under a sail (legacy `sailLineHtml`, as text).
 * @param name - Sail name.
 * @param color - Colour.
 * @param description - Inscription or drawing.
 * @returns `{ fr, en }` (en capitalized), or `null` when nothing to show.
 */
export function sailLineTexts(
  name: unknown,
  color: unknown,
  description: unknown,
): { fr: string; en: string } | null {
  const sailName = text(name);
  const sailColor = text(color);
  const sailDescription = text(description);
  if (!sailName || (!sailColor && !sailDescription)) return null;
  const french = `${sailName} : ${[sailColor, sailDescription].filter(Boolean).join(', ')}`;
  const english = `${sailColor ? `${colorEnOrder(sailColor)} ` : ''}${SAIL_EN[sailName.toLowerCase()] || sailName}${sailDescription ? `, ${descEn(sailDescription)}` : ''}`;
  return {
    fr: french,
    en: english.charAt(0).toUpperCase() + english.slice(1),
  };
}

/**
 * Each described sail: mainsail first, then the headsails (legacy `sailDescs`).
 * @param values - Boat sheet values.
 * @returns `[name, description]` pairs.
 */
function sailDescs(values: Values): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const main = sailJoin(values.gvColor, values.gvDesc);
  if (main) out.push(['Grand-voile', main]);
  const names = textOf(values.voilesAvant)
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
  const descriptions = Array.isArray(values.voilesDesc)
    ? values.voilesDesc
    : [];
  const colors = Array.isArray(values.voilesColor) ? values.voilesColor : [];
  for (const [position, name] of names.entries()) {
    const description = sailJoin(colors[position], descriptions[position]);
    if (description) out.push([name, description]);
  }
  return out;
}

/**
 * Sails sentence of the radio description (legacy `sailsTxt`).
 * @param values - Boat sheet values.
 * @param lang - `'fr'` or `'en'`.
 * @returns e.g. `mainsail (white), genoa (blue)`.
 */
function sailsTxt(values: Values, lang: string): string {
  return sailDescs(values)
    .map(([name, description]) =>
      lang === 'fr'
        ? `${name.toLowerCase()} (${description.trim()})`
        : `${SAIL_EN[name.toLowerCase()] || name} (${descEn(description)})`,
    )
    .join(', ');
}

/**
 * Description of the boat for the radio (legacy `radioDesc`).
 * @param values - Boat sheet values.
 * @param lang - `'fr'` or `'en'`.
 * @param autoOnly - Ignore the description forced by hand (`desc`).
 * @returns The description.
 */
export function radioDesc(
  values: Values,
  lang: string,
  autoOnly = false,
): string {
  if (!autoOnly && values.desc) return textOf(values.desc);
  const loa = num(values.loa);
  const loaFt = num(values.loaFt);
  const feet = loaFt ?? (loa == null ? null : Math.round(loa / 0.3048));
  const metres =
    loa ?? (loaFt == null ? null : Math.round(loaFt * 0.3048 * 10) / 10);
  const model = textOf(values.model).trim();
  const short: string[] = [];
  for (const word of model
    .replaceAll(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)) {
    if (!/^[A-Z0-9]/.test(word)) break;
    short.push(word);
  }
  const modelShort = short.join(' ') || model;
  const hullColor = textOf(values.hullColor);
  const marking = textOf(values.marking);
  const sailColor = textOf(values.sailColor);
  if (lang === 'fr') {
    return [
      `Voilier${modelShort ? ` ${modelShort}` : ''}`,
      feet == null
        ? ''
        : `${Math.round(feet)} pieds${metres == null ? '' : ` (${frN(metres)} m)`}`,
      hullColor ? `coque ${hullColor.trim()}` : '',
      marking ? `sur la coque : ${marking.trim()}` : '',
      sailsTxt(values, 'fr') || (sailColor ? `voiles ${sailColor.trim()}` : ''),
    ]
      .filter(Boolean)
      .join(', ');
  }
  return [
    `Sailing yacht${modelShort ? ` ${modelShort}` : ''}`,
    feet == null ? '' : `${Math.round(feet)} feet`,
    hullColor ? `${descEn(hullColor)} hull` : '',
    marking ? `on the hull: ${descEn(marking)}` : '',
    sailsTxt(values, 'en') ||
      (sailColor ? `${colorEnOrder(sailColor)} sails` : ''),
  ]
    .filter(Boolean)
    .join(', ');
}
