import { fr, pad } from '../../lib/format.ts';
import { bft, windTxt } from '../../lib/wind.ts';
import { DOUGLAS } from '../../model/lists.ts';
import type { Settings } from '../../model/settings.ts';

import type {
  SeaState,
  WindMeta,
  WindReading,
  WindSignal,
} from './windTypes.ts';

/** Wind alert configuration with its defaults (legacy `windAlert()`). */
export interface WindConfig {
  on: boolean;
  /** `'gust'` or `'avg'`. */
  basis: string;
  /** Station search radius in km. */
  radius: number;
  /** Météo-France API key, empty without one. */
  mfKey: string;
  [key: string]: unknown;
}

/** Delay of the bubble: after the two flashes (2 × 1.2 s + 0.4 s). */
export const WIND_POP_DELAY = 2900;

// Theoretical wave height of the Beaufort scale (WMO, open sea, established wind).
const WAVE_OMM: Readonly<Record<number, number>> = {
  1: 0.1,
  2: 0.2,
  3: 0.6,
  4: 1,
  5: 2,
  6: 3,
  7: 4,
  8: 5.5,
  9: 7,
  10: 9,
  11: 11.5,
  12: 14,
};

// Flash colours from 4 Bf on, more and more dramatic.
const WIND_FLASH = [
  '#7ed957',
  '#c8e64a',
  '#ffe14d',
  '#ffb330',
  '#ff7a1a',
  '#f03c1e',
  '#c4001a',
  '#8a0033',
  '#4b0055',
  '#22002b',
] as const;

const DOUGLAS_H = [0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];

/**
 * Wind alert settings with their defaults (legacy `windAlert`).
 * @param settings - User settings.
 * @returns The configuration.
 */
export function windAlertConfig(settings: Settings): WindConfig {
  return {
    on: true,
    basis: 'gust',
    radius: 30,
    mfKey: '',
    ...settings.windAlert,
  };
}

/**
 * Value compared with the thresholds.
 * @param reading - Wind reading.
 * @param basis - `'gust'` or `'avg'`.
 * @returns Knots.
 */
export function windValue(reading: WindReading, basis: string): number {
  return basis === 'gust' ? (reading.gust ?? reading.avg) : reading.avg;
}

/**
 * Alert level: 0 for 4 Bf (11 knots) up to 8 for 12 Bf; -1 below (legacy `windLevel`).
 * @param knots - Wind in knots.
 * @returns The level.
 */
export function windLevel(knots: number | null | undefined): number {
  if (knots == null || bft(knots) < 4) return -1;
  return bft(knots) - 4;
}

/**
 * Colour of an alert level (legacy `flashColor`).
 * @param level - Alert level.
 * @returns The colour.
 */
export function flashColor(level: number): string {
  return WIND_FLASH[Math.min(level, WIND_FLASH.length - 1)] as string;
}

/**
 * Readable text colour on a flash colour (legacy `flashInk`).
 * @param hex - `#rrggbb`.
 * @returns `#000` or `#fff`.
 */
export function flashInk(hex: string): string {
  const color = Number.parseInt(hex.slice(1), 16);
  const red = Math.floor(color / 65_536);
  const green = Math.floor(color / 256) % 256;
  const blue = color % 256;
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 150 ? '#000' : '#fff';
}

/**
 * Douglas degree of a wave height (legacy `douglasOfH`).
 * @param height - Wave height in metres.
 * @returns The degree, 0 to 9.
 */
export function douglasOfH(height: number): number {
  let degree = 0;
  while (degree < DOUGLAS_H.length && height > (DOUGLAS_H[degree] as number)) {
    degree++;
  }
  return Math.min(9, degree);
}

/**
 * Sea state in a sentence (legacy `seaTxt`).
 * @param sea - Wave height and optional Douglas degree.
 * @returns The sentence, or `''`.
 */
export function seaTxt(sea: Partial<SeaState> | null | undefined): string {
  if (sea?.waveH == null) return '';
  const degree = sea.douglas ?? douglasOfH(sea.waveH);
  return `mer ${degree} ${DOUGLAS[degree]?.[1] ?? ''}, vagues ${fr(sea.waveH)} m`;
}

/**
 * WMO reference of a Beaufort force (legacy `waveOmmTxt`).
 * @param force - Beaufort force.
 * @returns The sentence, or `''` for 0.
 */
export function waveOmmTxt(force: number): string {
  const height = WAVE_OMM[Math.max(1, Math.min(12, force))];
  if (height == null) return '';
  const degree = douglasOfH(height);
  const more = force >= 12 ? ' et plus' : '';
  return `théorique OMM : mer ${degree} ${DOUGLAS[degree]?.[1]}, vagues ≈ ${fr(height)} m${more} (pleine mer, vent établi)`;
}

/**
 * The Beaufort force whose wind raises such waves in open sea, from the WMO
 * table (the smallest force whose probable height reaches it).
 * @param height - Wave height in metres.
 * @returns The force, 0 for a calm sea.
 */
export function beaufortOfWaves(height: number): number {
  if (height <= 0) return 0;
  for (let force = 1; force <= 12; force++) {
    if ((WAVE_OMM[force] ?? 0) >= height) return force;
  }
  return 12;
}

/**
 * The marks under the sea state of a published alert: where the figures come
 * from, the Douglas degree of the waves, the Beaufort force that raises them,
 * and the WMO reference for the force measured.
 * @param height - Significant wave height of the model, in metres.
 * @param force - Beaufort force of the alert.
 * @returns `[title, text]` pairs.
 */
export function seaMarks(
  height: number,
  force: number,
): Array<[string, string]> {
  const degree = douglasOfH(height);
  const waveForce = beaufortOfWaves(height);
  return [
    [
      'Provenance',
      'Vagues et houle : Open-Meteo Marine, « Best Match » (le meilleur modèle pour le lieu : Météo-France MFWAM, ECMWF WAM, DWD ou NOAA GFS Wave). Courant : Météo-France SMOC. Eau : Météo-France, température de surface.',
    ],
    [
      'Échelle de Douglas',
      `vagues de ${fr(height)} m = degré ${degree}, mer ${DOUGLAS[degree]?.[1] ?? ''}`,
    ],
    [
      'En Beaufort',
      `ces vagues sont celles d’un vent de force ${waveForce} Bf établi en pleine mer (table OMM)`,
    ],
    [
      `OMM pour ${force} Bf`,
      `${waveOmmTxt(force).replace('théorique OMM : ', '')}. Organisation météorologique mondiale : hauteur probable des vagues au large, pour un vent établi depuis longtemps sur une grande distance ; près des côtes la mer est souvent plus petite, et la houle venue d’ailleurs peut la grossir.`,
    ],
  ];
}

/** The marine model the app reads (Open-Meteo picks the best for the place). */
export const SEA_MODEL = 'Best Match';

/**
 * Sample sea state of the test mode: 70 % of the WMO wave height.
 * @param force - Beaufort force.
 * @returns The sentence shown in the test bubble.
 */
export function testSeaTxt(force: number): string {
  const height = Math.round((WAVE_OMM[force] ?? 0) * 0.7 * 10) / 10;
  const degree = douglasOfH(height);
  return `modèle ${SEA_MODEL} (exemple fictif) : mer ${degree} ${DOUGLAS[degree]?.[1]}, vagues ${fr(height)} m`;
}

/**
 * A new signal is due: first one, a stronger degree, another degree after a
 * minute, or the 15-minute reminder (legacy `windFire`).
 * @param level - Current level (≥ 0).
 * @param last - Last signal, or null.
 * @param now - Epoch milliseconds.
 * @returns `true` to signal.
 */
export function signalDue(
  level: number,
  last: WindSignal | null,
  now: number,
): boolean {
  if (!last || level > last.level) return true;
  if (level !== last.level && now - last.at > 60_000) return true;
  return now - last.at >= 15 * 60_000;
}

/**
 * Journal note of a wind alert (legacy `windFire`).
 * @param top - Strongest reading.
 * @param meta - Check context.
 * @returns The note.
 */
export function windAlertNote(top: WindReading, meta: WindMeta): string {
  const gust = top.gust == null ? '…' : windTxt(top.gust);
  const direction =
    top.dir == null ? '' : ` du ${pad(Math.round(top.dir), 3)}°`;
  const lowered = meta.bias ? `, seuils abaissés de ${meta.bias} nd` : '';
  const where =
    meta.src === 'model'
      ? `PRÉVISION ${top.name} à la position du bateau, pas une mesure (aucune station à moins de ${meta.radius ?? 30} km${lowered})`
      : `mesuré à ${top.name} (station ${top.net ?? 'MeteoSwiss'}${top.km == null ? '' : `, ${Math.round(top.km)} km`})`;
  const sea = meta.waveH == null ? '' : ` ; ${seaTxt(meta)}`; // never set on a lake
  return `${windTxt(top.avg)}, rafales ${gust}${direction} ${where}${sea}`;
}

/**
 * Journal note of an alert kept silent until the end of the track (legacy `windFire`).
 * @param top - Strongest reading.
 * @returns The note.
 */
export function windMutedNote(top: WindReading): string {
  const gust = top.gust == null ? '…' : windTxt(top.gust);
  return `${windTxt(top.avg)}, rafales ${gust} (alerte non diffusée jusqu’à la fin de la trace)`;
}
