import { BFT_KN } from '../model/lists.ts';

import { stringOf } from './format.ts';

/**
 * Beaufort force of a wind speed (legacy `bft`).
 * @param knots - Speed in knots.
 * @returns Force 0 to 12.
 */
export function bft(knots: unknown): number {
  const rounded = Math.round(Number(knots));
  let force = 0;
  while (force < 12 && rounded >= (BFT_KN[force] as number)) force++;
  return force;
}

/**
 * Knots to km/h, rounded (legacy `kmh`).
 * @param knots - Speed in knots.
 * @returns Speed in km/h.
 */
export function kmh(knots: unknown): number {
  return Math.round(Number(knots) * 1.852);
}

/**
 * A usable wind speed was given (legacy `knOk`).
 * @param knots - Speed (number or text with comma).
 * @returns `true` when finite.
 */
export function knOk(knots: unknown): boolean {
  return knots != null && knots !== '' && Number.isFinite(knNum(knots));
}

/**
 * Speed written with a comma, as a number (legacy `knNum`).
 * @param knots - Speed.
 * @returns The number.
 */
function knNum(knots: unknown): number {
  return Number(stringOf(knots).replace(',', '.'));
}

/**
 * Wind as text: `12 nd · 4 Bf (22 km/h)` (legacy `windTxt`).
 * @param knots - Speed in knots.
 * @returns The text, or `''`.
 */
export function windTxt(knots: unknown): string {
  if (!knOk(knots)) return '';
  const speed = knNum(knots);
  return `${Math.round(speed)} nd · ${bft(speed)} Bf (${kmh(speed)} km/h)`;
}

/**
 * Wind conversion under an input: `4 Bf · 22 km/h` (legacy `windConv`).
 * @param knots - Speed in knots.
 * @returns The text, or `''`.
 */
export function windConv(knots: unknown): string {
  if (!knOk(knots)) return '';
  const speed = knNum(knots);
  return `${bft(speed)} Bf · ${kmh(speed)} km/h`;
}

/** Parts of the wind display (data of legacy `windHtml`). */
interface WindParts {
  knots: number;
  beaufort: number;
  kmh: number;
}

/**
 * Data of the wind display: `<b>{knots} nd · {beaufort} Bf</b> <small class="kmh">{kmh} km/h</small>`,
 * or `…` when absent (legacy `windHtml`).
 * @param knots - Speed in knots.
 * @returns The parts, or `null` when not usable.
 */
export function windParts(knots: unknown): WindParts | null {
  if (!knOk(knots)) return null;
  const speed = knNum(knots);
  return { knots: Math.round(speed), beaufort: bft(speed), kmh: kmh(speed) };
}

const POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSO',
  'SO',
  'OSO',
  'O',
  'ONO',
  'NO',
  'NNO',
] as const;

/**
 * Compass point a wind comes from.
 * @param degrees - Direction in degrees.
 * @returns `N`, `NNE`… (`O` for west).
 */
export function compassPoint(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return POINTS[index] as string;
}
