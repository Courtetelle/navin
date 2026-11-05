/**
 * Point of sail for a true wind angle (legacy `allureFromTwa`).
 * @param twa - True wind angle, 0-180°.
 * @returns The French label stored in the logbook.
 */
export function allureFromTwa(twa: number): string {
  if (twa < 45) return 'Près serré';
  if (twa < 60) return 'Près';
  if (twa < 80) return 'Bon plein';
  if (twa < 105) return 'Travers';
  if (twa < 135) return 'Largue';
  if (twa < 165) return 'Grand largue';
  return 'Vent arrière';
}

const DOUGLAS_LIMITS = [0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];

/**
 * Douglas sea state of a wave height (legacy `douglasFromHeight`).
 * @param height - Significant wave height in metres.
 * @returns The degree, `'0'` to `'9'`.
 */
export function douglasFromHeight(height: number): string {
  let degree = 0;
  while (degree < DOUGLAS_LIMITS.length) {
    const limit = DOUGLAS_LIMITS[degree];
    if (limit === undefined || height <= limit) break;
    degree++;
  }
  return String(Math.min(9, degree));
}
