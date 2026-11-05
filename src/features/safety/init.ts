import { addNavigationListener } from '../../shell/router.ts';
import { setTopMenuActions } from '../../shell/topbar/topMenuState.ts';
import { sosLogActive, state } from '../../state/index.ts';

import { mobPrepare } from './mobPrepare.ts';
import { initMobProcedures, reloadMobProcedures } from './mobProcedures.ts';
import { showSafetyOverlay } from './overlayRoot.ts';
import { sosExOn } from './sosExercise.ts';
import { installSosListeners } from './sosListeners.ts';
import { sosLogStart } from './sosLogStart.ts';

initMobProcedures();
installSosListeners();
showSafetyOverlay();

setTopMenuActions({
  sosTap: () => {
    if (state.view.sosSim.value && !sosLogActive()) return;
    sosLogStart(sosExOn() ? '🧪 Exercice : touche SOS du haut' : 'Touche SOS');
  },
});

addNavigationListener(({ phase, to, arg }) => {
  if (phase !== 'after' || to !== 'mob') return;
  reloadMobProcedures();
  mobPrepare(arg);
});
