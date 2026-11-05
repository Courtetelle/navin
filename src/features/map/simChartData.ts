import type { LatLngPair } from './constants.ts';

/** Approximate shore of Lake Geneva. */
const SIM_LEMAN: readonly LatLngPair[] = [
  [46.205, 6.16],
  [46.215, 6.18],
  [46.255, 6.215],
  [46.302, 6.243],
  [46.33, 6.28],
  [46.372, 6.326],
  [46.36, 6.345],
  [46.348, 6.36],
  [46.335, 6.38],
  [46.345, 6.41],
  [46.355, 6.43],
  [46.378, 6.48],
  [46.398, 6.53],
  [46.401, 6.59],
  [46.405, 6.655],
  [46.408, 6.72],
  [46.393, 6.805],
  [46.39, 6.86],
  [46.386, 6.878],
  [46.398, 6.925],
  [46.43, 6.912],
  [46.46, 6.845],
  [46.488, 6.73],
  [46.503, 6.685],
  [46.506, 6.627],
  [46.508, 6.56],
  [46.507, 6.497],
  [46.478, 6.455],
  [46.46, 6.34],
  [46.42, 6.28],
  [46.383, 6.24],
  [46.345, 6.215],
  [46.315, 6.19],
  [46.28, 6.17],
  [46.255, 6.155],
  [46.212, 6.152],
];

/** Hand-drawn Provence coast and the Hyères islands: for the preview, not to navigate. */
const SIM_MED: ReadonlyArray<readonly LatLngPair[]> = [
  [
    [45.5, 4],
    [43.45, 4],
    [43.45, 4.6],
    [43.4, 4.85],
    [43.33, 5.05],
    [43.335, 5.2],
    [43.36, 5.3],
    [43.33, 5.345],
    [43.296, 5.362],
    [43.265, 5.372],
    [43.235, 5.355],
    [43.212, 5.34],
    [43.205, 5.4],
    [43.212, 5.45],
    [43.205, 5.5],
    [43.212, 5.54],
    [43.19, 5.58],
    [43.172, 5.605],
    [43.16, 5.622],
    [43.178, 5.66],
    [43.18, 5.7],
    [43.135, 5.75],
    [43.118, 5.8],
    [43.075, 5.795],
    [43.045, 5.86],
    [43.07, 5.9],
    [43.1, 5.885],
    [43.118, 5.93],
    [43.104, 5.945],
    [43.09, 5.975],
    [43.088, 6.02],
    [43.078, 6.075],
    [43.07, 6.12],
    [43.04, 6.105],
    [43.028, 6.115],
    [43.03, 6.16],
    [43.045, 6.155],
    [43.07, 6.15],
    [43.1, 6.19],
    [43.115, 6.25],
    [43.12, 6.31],
    [43.135, 6.37],
    [43.145, 6.44],
    [43.17, 6.53],
    [43.19, 6.6],
    [43.2, 6.68],
    [43.24, 6.69],
    [43.27, 6.66],
    [43.29, 6.6],
    [43.31, 6.635],
    [43.34, 6.7],
    [43.4, 6.76],
    [43.41, 6.85],
    [43.47, 6.94],
    [43.55, 7.02],
    [43.7, 7.25],
    [43.75, 7.5],
    [43.78, 7.6],
    [45.5, 7.6],
  ],
  [
    [43.005, 6.16],
    [43.01, 6.2],
    [43, 6.245],
    [42.985, 6.24],
    [42.99, 6.19],
    [42.992, 6.16],
  ],
  [
    [43.012, 6.37],
    [43.016, 6.4],
    [43.003, 6.415],
    [42.995, 6.385],
  ],
  [
    [43.03, 6.43],
    [43.05, 6.49],
    [43.046, 6.512],
    [43.022, 6.452],
  ],
];

/**
 * Smooth a closed ring by corner cutting (Chaikin).
 * @param ring - Points of the ring.
 * @param passes - Number of passes.
 * @returns The smoothed ring.
 */
export function chaikin(
  ring: readonly LatLngPair[],
  passes: number,
): LatLngPair[] {
  let points = [...ring];
  for (let pass = 0; pass < passes; pass++) {
    const next: LatLngPair[] = [];
    for (let index = 0; index < points.length; index++) {
      const [aLat, aLon] = points[index] as LatLngPair;
      const [bLat, bLon] = points[(index + 1) % points.length] as LatLngPair;
      next.push(
        [aLat * 0.75 + bLat * 0.25, aLon * 0.75 + bLon * 0.25],
        [aLat * 0.25 + bLat * 0.75, aLon * 0.25 + bLon * 0.75],
      );
    }
    points = next;
  }
  return points;
}

/** Smoothed shore of Lake Geneva. */
export const SIM_LEMAN_SMOOTH = chaikin(SIM_LEMAN, 3);
/** Smoothed Provence coast and islands. */
export const SIM_MED_SMOOTH = SIM_MED.map((ring) => chaikin(ring, 2));
/** View of the simulated sea. */
export const SIM_MED_CENTER: LatLngPair = [43, 5.95];
