import { dayKey } from '../../lib/format.ts';
import { lastKnownPos, state } from '../../state/index.ts';
import { nearestPort } from '../onwater/index.ts';

import { vhfContext } from './vhfContext.ts';
import type { VhfCallKey, VhfContext } from './vhfTypes.ts';

/**
 * Values of a routine call from the open cruise and the position (legacy
 * `vhfContext`). Call it only with a cruise open.
 * @param call - Call.
 * @returns The values of the script.
 */
export function currentVhfContext(call: VhfCallKey): VhfContext {
  const cruise = state.data.cruise.value;
  if (!cruise) throw new Error('VHF call without an open cruise');
  const position = lastKnownPos();
  return vhfContext(call, {
    info: cruise.info,
    crew: cruise.crew,
    position,
    now: new Date(),
    day: cruise.days[dayKey(new Date())] ?? {},
    remembered: (state.preferences.settings.value.vhf ?? {}) as Record<
      string,
      unknown
    >,
    nearestPort:
      position?.lat == null ? '' : nearestPort(position.lat, position.lon, 10),
  });
}
