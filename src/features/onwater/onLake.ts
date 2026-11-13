import { isLake, navZone } from '../../state/index.ts';

/**
 * On a lake: the place of NavIn, or a lake outing. There is no sea state
 * there (waves, swell, the WMO sea table): the marine model is for the sea.
 * @returns The boat is on a lake.
 */
export function onLake(): boolean {
  return isLake() || navZone() === 'lac';
}
