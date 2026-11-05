import type { MarginKey, Settings } from '../model/settings.ts';
import { MARGIN_DEFAULTS } from '../model/settings.ts';

import { frN, num } from './format.ts';

/** Loose record of sheet values. */
type Values = Record<string, unknown>;

/**
 * Add a margin and round up to a step (legacy `autoAdd`).
 * @param value - Base value (comma or dot).
 * @param add - Margin to add.
 * @param step - Rounding step (0 = exact value with up to 2 decimals).
 * @returns The French formatted result, or `''` when the base is empty.
 */
export function autoAdd(value: unknown, add: number, step: number): string {
  const base = num(value);
  if (base == null) return '';
  const sum = Math.round((base + add) * 1000) / 1000;
  if (!step) return String(Math.round(sum * 100) / 100).replace('.', ',');
  const rounded = Math.ceil(sum / step - 1e-9) * step;
  return rounded.toFixed(step < 1 ? 1 : 0).replace('.', ',');
}

/**
 * Margin from the settings, or its default (legacy `marginVal`).
 * @param settings - User settings.
 * @param key - Margin key.
 * @returns The margin.
 */
export function marginVal(settings: Settings, key: MarginKey): number {
  const value = num(settings[key]);
  return value == null ? MARGIN_DEFAULTS[key] : value;
}

/**
 * Rounding step from the settings (legacy `roundStep`).
 * @param settings - User settings.
 * @param key - `'arrProf'` or `'arrHaut'`.
 * @returns The step, 0.1 by default.
 */
export function roundStep(settings: Settings, key: string): number {
  const value = settings[key];
  return typeof value === 'number' ? value : 0.1;
}

/**
 * Rounding sentence of a computed rule (legacy `stepTxt`).
 * @param settings - User settings.
 * @param key - Rounding setting key.
 * @returns e.g. `, arrondi au 0,1 m supérieur`, or `''` for exact values.
 */
export function stepTxt(settings: Settings, key: string): string {
  const step = roundStep(settings, key);
  return step ? `, arrondi au ${frN(step)} m supérieur` : '';
}

/**
 * Convert a paired value (legacy `pairConv`).
 * @param value - Source value.
 * @param factor - Conversion factor.
 * @param decimals - Decimals of the result.
 * @returns The French formatted result, or `''`.
 */
export function pairConv(
  value: unknown,
  factor: number,
  decimals: number,
): string {
  const source = num(value);
  return source == null
    ? ''
    : String(
        Math.round(source * factor * 10 ** decimals) / 10 ** decimals,
      ).replace('.', ',');
}

/**
 * The key holds a non-empty value (legacy `has`).
 * @param values - Sheet values.
 * @param key - Key.
 * @returns `true` when set.
 */
export function has(values: Values, key: string): boolean {
  return values[key] != null && values[key] !== '';
}

/**
 * Of two paired fields, the one typed second is manual (shown in red);
 * the first filled is the base, recorded in `pairSrc_<keys>` (legacy `pairManual`).
 * @param values - Sheet values.
 * @param key - Field key.
 * @param other - Paired field key.
 * @param fallback - Base key when none is recorded.
 * @returns `true` when this field is the manual one.
 */
export function pairManual(
  values: Values,
  key: string,
  other: string,
  fallback = 'loa',
): boolean {
  if (!has(values, key) || !has(values, other)) return false;
  const source = values[`pairSrc_${[key, other].toSorted().join('_')}`];
  return (source || fallback) !== key;
}
