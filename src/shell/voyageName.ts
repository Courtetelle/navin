import { MODES, modeOf } from '../model/modes.ts';
import type { Cruise } from '../model/types.ts';
import { state } from '../state/index.ts';

/**
 * Text of the hidden `#voyageName` element (app.js:666): the mode icon and the
 * cruise name, or `NavIn` without an open cruise.
 * @param cruise - Open cruise (defaults to the state's).
 * @returns The voyage name.
 */
export function computeVoyageName(
  cruise: Cruise | null = state.data.cruise.value,
): string {
  if (!cruise) return 'NavIn';
  return `${MODES[modeOf(cruise)].icon} ${cruise.info.name || ''}`;
}
