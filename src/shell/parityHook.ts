import { signal } from '@preact/signals-react';

import { go, navigation } from './router.ts';

/** Router hook used by the parity harness (`scripts/parity`), development only. */
interface ParityHook {
  go: (view: string, arg?: unknown) => void;
  /** Unmount the current page, to compare the chrome alone. */
  blankPage: () => void;
}

/** Navigation whose page the harness unmounted (scenarios of the chrome). */
export const blankedNavigation = signal(0);

const pending: Array<() => void> = [];
let started = false;

/**
 * Install `window.__parity` in development builds, at the very start: what
 * the harness asks before the first screen waits for it.
 */
export function installParityHook(): void {
  if (!import.meta.env.DEV) return;
  (globalThis as unknown as { __parity?: ParityHook }).__parity = {
    go: (view, arg) => afterStart(() => go(view, arg)),
    blankPage: () => {
      afterStart(() => {
        blankedNavigation.value = navigation.peek().id;
      });
    },
  };
}

/** The first screen is open: run what the harness asked meanwhile. */
export function parityStarted(): void {
  started = true;
  for (const action of pending.splice(0)) action();
}

function afterStart(action: () => void): void {
  if (started) action();
  else pending.push(action);
}
