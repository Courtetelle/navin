import { effect, signal } from '@preact/signals-react';

import { state } from '../state/index.ts';

import { setBodyClass } from './bodyClass.ts';

/** The muted looping video that keeps old iPhones awake is in the page. */
export const wakeVideoOn = signal(false);

let wakeLock: WakeLockSentinel | null = null;

const wakeWanted = () =>
  state.preferences.settings.peek().wake || state.view.tracking.peek();

/**
 * Keep the screen on: always while a track records, otherwise as set; without
 * Wake Lock, a tiny muted video plays the same role (app.js:605-638). Also
 * sets the body class `is-tracking` (the NavIn tab turns green).
 * @returns Resolves once the lock is taken or released.
 */
export function applyWake(): Promise<void> {
  return updateWake(wakeWanted());
}

function updateWake(wanted: boolean): Promise<void> {
  setBodyClass('is-tracking', state.view.tracking.peek());
  const want = wanted && document.visibilityState === 'visible';
  if (!('wakeLock' in navigator)) {
    wakeVideoOn.value = want;
    return Promise.resolve();
  }
  const fallback = () => {
    wakeVideoOn.value = want;
  };
  if (want && !wakeLock) {
    return navigator.wakeLock.request('screen').then(holdLock, fallback);
  }
  if (!want && wakeLock) {
    const lock = wakeLock;
    wakeLock = null;
    return lock.release().catch(fallback);
  }
  return Promise.resolve();
}

/**
 * Apply the wake lock now, when the page becomes visible again, at the first
 * touch (the lock may need a gesture), and whenever the setting or the
 * tracking changes.
 * @returns Removes the listeners.
 */
export function followWake(): () => void {
  document.addEventListener('visibilitychange', applyWakeLater);
  document.addEventListener('pointerdown', retryWake, { passive: true });
  const stop = effect(() => {
    void updateWake(
      state.preferences.settings.value.wake || state.view.tracking.value,
    );
  });
  return () => {
    stop();
    document.removeEventListener('visibilitychange', applyWakeLater);
    document.removeEventListener('pointerdown', retryWake);
  };
}

function holdLock(lock: WakeLockSentinel): void {
  wakeLock = lock;
  lock.addEventListener('release', () => {
    wakeLock = null;
    if (wakeWanted() && document.visibilityState === 'visible') {
      setTimeout(applyWakeLater, 500);
    }
  });
}

function applyWakeLater(): void {
  void applyWake();
}

function retryWake(): void {
  if (wakeWanted() && !wakeLock) void applyWake();
}
