import { state } from '../../state/index.ts';

import { resumeAudio, unlockAudio } from './windAudio.ts';
import { windAlertConfig } from './windLogic.ts';

/**
 * Start the wind watch shortly after boot: alerts work on every screen, with
 * or without an open cruise. Sound can only be unlocked by a touch. The watch
 * loads apart so a failure in the weather code never reaches the boot.
 */
export function startWindWatch(): void {
  // Safari counts the end of a touch as the gesture that unlocks the sound.
  for (const type of ['pointerdown', 'pointerup', 'touchend'] as const) {
    document.addEventListener(
      type,
      () => {
        if (alertsOn()) unlockAudio();
      },
      { passive: true, capture: true },
    );
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && alertsOn()) resumeAudio();
  });
  setTimeout(() => {
    void import('./windWatch.ts').then(({ windWatchStart }) =>
      windWatchStart(),
    );
  }, 2000);
  setInterval(() => {
    void import('./windWatch.ts').then(({ windReminderTick }) =>
      windReminderTick(),
    );
  }, 60_000);
  // Another zone of navigation (NavIn, the boat arrow): the alerts start
  // again for the place the map now shows.
  let known = state.view.zoneSimV.peek();
  let settle: ReturnType<typeof setTimeout> | undefined;
  state.view.zoneSimV.subscribe((zone) => {
    if (zone === known) return;
    known = zone;
    clearTimeout(settle);
    settle = setTimeout(() => {
      void import('./windWatch.ts').then(({ windWatchRestart }) =>
        windWatchRestart(),
      );
    }, ZONE_SETTLE_MS);
  });
  // The stations around the GPS position are recorded, for the trends of
  // Live météo wherever the boat is.
  setTimeout(record, 30_000);
  setInterval(record, RECORD_EVERY_MS);
}

/** Time for the map to reach the new zone before the wind is read there. */
const ZONE_SETTLE_MS = 1500;

/** The stations around the boat are recorded this often. */
const RECORD_EVERY_MS = 10 * 60_000;

function record(): void {
  void import('./liveRecorder.ts')
    .then(({ recordAround }) => recordAround())
    .catch(() => undefined);
}

function alertsOn(): boolean {
  return windAlertConfig(state.preferences.settings.value).on;
}
