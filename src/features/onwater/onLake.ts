import { BEAUFORT_TBL } from '../../model/lists.ts';
import { isLake, navZone } from '../../state/index.ts';

/**
 * On a lake: the place of NavIn, or a lake outing. There is no sea state
 * there (waves, swell, the WMO sea table): the marine model is for the sea.
 * @returns The boat is on a lake.
 */
export function onLake(): boolean {
  return isLake() || navZone() === 'lac';
}

/**
 * The sea of a Beaufort force, as the scale describes it (« vagues
 * modérées… »): open sea only, so nothing on a lake.
 * @param force - Beaufort force.
 * @returns The sentence, empty on a lake.
 */
export function beaufortSea(force: number): string {
  if (onLake()) return '';
  return BEAUFORT_TBL[Math.max(0, Math.min(12, force))]?.[4] ?? '';
}
