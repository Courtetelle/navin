import { data } from './data.ts';
import { initState } from './init.ts';
import { firstZone } from './mode.ts';
import { preferences } from './preferences.ts';
import { view } from './view.ts';

/** The whole application state: `view` (ephemeral UI), `data` (records), `preferences` (settings). */
export const state = { view, data, preferences };

export * from './actions.ts';

// Like the legacy scripts, the browser loads (and migrates) the stored data as
// soon as the state is imported; node tests call `initState(storage)` themselves.
if ('document' in globalThis) {
  initState();
  // No zone ever chosen: the Atlantique, until the boat arrow is touched.
  firstZone();
}
export {
  alertLog,
  eraseAlerts,
  eraseAlertsBetween,
  mergeAlerts,
  recordAlert,
} from './alertLog.ts';
