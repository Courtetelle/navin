import { effect } from '@preact/signals-react';

import { addNavigationListener } from '../../shell/router.ts';
import { setTopMenuActions } from '../../shell/topbar/topMenuState.ts';
import { prepReady, setPrep, setPrepReady, state } from '../../state/index.ts';

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

// START after a closed PréP: the PréP button turns white again, and the
// check-in is kept for the logbook then emptied for the next outing.
effect(() => {
  if (!state.view.tracking.value || prepReady.peek() === null) return;
  setPrepReady(null);
  void import('./prepClose.ts').then(({ archiveCheckIn }) => archiveCheckIn());
});
