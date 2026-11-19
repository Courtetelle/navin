import { effect } from '@preact/signals-react';

import { state } from '../../state/index.ts';

import { syncRound } from './syncEngine.ts';

/** While NavIn is shown, a look at the relay this often. */
const LOOK_MS = 2 * 60 * 1000;
/** The first round waits for the start of NavIn. */
const FIRST_MS = 8000;

// The synchronisation runs by itself: at the start, every 2 minutes while
// NavIn is shown, when it comes back on screen or goes away, and when a
// recording ends (the track kept waiting is merged then).
setTimeout(() => {
  void syncRound();
}, FIRST_MS);
setInterval(() => {
  if (document.visibilityState === 'visible') void syncRound();
}, LOOK_MS);
document.addEventListener('visibilitychange', () => {
  void syncRound();
});
let wasTracking = state.view.tracking.peek();
effect(() => {
  const tracking = state.view.tracking.value;
  if (wasTracking && !tracking) void syncRound();
  wasTracking = tracking;
});
