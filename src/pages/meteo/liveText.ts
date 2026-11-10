import type { LiveStation, MfTally } from '../../features/onwater/index.ts';
import {
  flashColor,
  flashInk,
  windLevel,
} from '../../features/onwater/index.ts';
import { bft } from '../../lib/wind.ts';

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

/** Colour of a calm wind, under 4 Beaufort. */
const CALM = '#9ec9e8';

/**
 * Compass point a wind comes from.
 * @param degrees - Direction in degrees.
 * @returns `N`, `NNE`… (`O` for west).
 */
export function compassPoint(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return POINTS[index] as string;
}

/**
 * How old a measurement is, in words.
 * @param t - Epoch milliseconds of the measurement.
 * @param now - Epoch milliseconds.
 * @returns `à l’instant`, `il y a 7 min`…
 */
export function ageText(t: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - t) / 60_000));
  return minutes < 1 ? 'à l’instant' : `il y a ${minutes} min`;
}

/**
 * Colours of a station's marker, from the wind the alerts watch.
 * @param knots - Wind compared with the thresholds.
 * @returns Background and text colours.
 */
export function windColors(knots: number): { color: string; ink: string } {
  const level = windLevel(knots);
  const color = level < 0 ? CALM : flashColor(level);
  return { color, ink: flashInk(color) };
}

/**
 * Beaufort force of a reading, in words for the card.
 * @param knots - Wind in knots.
 * @returns `4 Bf`…
 */
export function forceText(knots: number): string {
  return `${bft(knots)} Bf`;
}

/**
 * The stations sorted for the list: the closest first.
 * @param stations - Stations.
 * @returns A new array.
 */
export function byDistance(stations: readonly LiveStation[]): LiveStation[] {
  return stations.toSorted((a, b) => (a.km ?? 0) - (b.km ?? 0));
}

/**
 * What the Météo-France stations of the search answered, in one line.
 * @param tally - The tally.
 * @param radius - Radius searched, in km.
 * @returns `Météo-France : 14 stations à moins de 30 km, 6 lues…`.
 */
export function mfTallyText(tally: MfTally, radius: number): string {
  if (tally.near === 0) {
    return `Météo-France : aucune station à moins de ${radius} km`;
  }
  const parts = [
    `${tally.near} station${tally.near > 1 ? 's' : ''} à moins de ${radius} km`,
  ];
  if (tally.read < tally.near) parts.push(`${tally.read} plus proches lues`);
  parts.push(`${tally.wind} avec vent`);
  if (tally.noWind > 0) {
    parts.push(
      `${tally.noWind} sans vent mesuré (pas d’anémomètre ou mesure ancienne)`,
    );
  }
  for (const [status, n] of Object.entries(tally.refused)) {
    parts.push(
      status === '429'
        ? `${n} refusée${n > 1 ? 's' : ''} : trop de demandes (429), réessayer dans 1 min`
        : `${n} refusée${n > 1 ? 's' : ''} (code ${status})`,
    );
  }
  if (tally.failed > 0) parts.push(`${tally.failed} sans réponse`);
  return `Météo-France : ${parts.join(' · ')}`;
}
