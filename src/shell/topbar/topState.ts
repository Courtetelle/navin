import { computed, effect } from '@preact/signals-react';

import { sosLogActive, state } from '../../state/index.ts';
import { setBodyClass } from '../bodyClass.ts';

/** An SOS simulation runs (position simulation or SOS drill), prep.js:1276. */
export const sosSimulation = computed(
  () => Boolean(state.view.sosSim.value) || Boolean(sosLogActive()?.ex),
);

/**
 * Show where one is (prep.js:1271-1284): `body.gear-on` on the settings or
 * during an SOS simulation, `body.sos-simu` during a simulation (the SOS tab
 * then carries « SIMULATION »).
 * @returns Stops following.
 */
export function followTopState(): () => void {
  return effect(() => {
    const simulation = sosSimulation.value;
    setBodyClass(
      'gear-on',
      state.view.currentView.value === 'settings' || simulation,
    );
    setBodyClass('sos-simu', simulation);
  });
}
