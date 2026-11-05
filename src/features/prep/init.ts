import { addNavigationListener } from '../../shell/router.ts';
import { setTopMenuActions } from '../../shell/topbar/topMenuState.ts';
import { setPrep, state } from '../../state/index.ts';

import { prepBarSync } from './prepBarSync.ts';

// Loaded on first use: other domains' modules must not weigh on the boot.
setTopMenuActions({
  prepStart: () => {
    void import('./prepFlow.ts').then(({ prepStart }) => prepStart());
  },
  quickStart: () => {
    void import('./quickStart.ts').then(({ quickStart }) => quickStart());
  },
  moorNow: () => {
    void import('./moor.ts').then(({ moorNow }) => moorNow());
  },
});

addNavigationListener(({ phase, to }) => {
  if (phase === 'before' && to === 'prep' && !state.data.prep.value) {
    setPrep({ step: 0 });
  }
  if (phase === 'after') prepBarSync(to);
});
