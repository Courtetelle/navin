import type { BoatPolar } from '../../model/polars.ts';
import { bestVmg, isBoatPolar, polarSpeed } from '../../model/polars.ts';
import type { Boat } from '../../model/types.ts';

/**
 * The polar of a boat as it is kept, or none.
 * @param boat - The boat.
 * @returns Its polar.
 */
export function boatPolarOf(boat: Boat | undefined): BoatPolar | null {
  return isBoatPolar(boat?.polar) ? boat.polar : null;
}

/**
 * What a polar gives at 10 kn of wind: best angle to the wind, beam reach,
 * best angle away from it, with the share made.
 * @param kept - The polar of the boat.
 * @returns « À 10 nd de vent : près 5,1 nd à 44°, travers 6,0 nd… ».
 */
export function polarDigest(kept: BoatPolar): string {
  const { polar, coef } = kept;
  const kn = (value: number) => (value * coef).toFixed(1).replace('.', ',');
  const beat = bestVmg(polar, 10);
  const run = bestVmg(polar, 10, true);
  const beatSpeed = polarSpeed(polar, beat.twa, 10);
  const runSpeed = polarSpeed(polar, run.twa, 10);
  return `À 10 nd de vent (${Math.round(coef * 100)} %) : près ${kn(beatSpeed)} nd à ${beat.twa}°, travers ${kn(polarSpeed(polar, 90, 10))} nd, portant ${kn(runSpeed)} nd à ${run.twa}°.`;
}
