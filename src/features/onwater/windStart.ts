import { state } from '../../state/index.ts';

import { resumeAudio, unlockAudio } from './windAudio.ts';
import { windAlertConfig } from './windLogic.ts';

/**
 * Start the wind watch shortly after boot: alerts work on every screen, with
 * or without an open cruise. Sound can only be unlocked by a touch. The watch
 * loads apart so a failure in the weather code never reaches the boot.
 */
export function startWindWatch(): void {
  // Alerts switched off come back on at the launch, if so chosen.
  void import('./windReOn.ts').then(({ applyReOn }) => applyReOn('launch'));
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
  // The alerts switched on or off (here or in another window of NavIn):
  // the watch starts or stops at once.
  let alertsWere = alertsOn();
  state.preferences.settings.subscribe(() => {
    const now = alertsOn();
    if (now === alertsWere) return;
    alertsWere = now;
    void import('./windWatch.ts').then(
      ({ resetWindSignal, windWatchStart }) => {
        resetWindSignal();
        windWatchStart();
      },
    );
  });
  // The lightning alert: on at the launch, and at once when switched.
  setTimeout(lightningStart, 3000);
  let lightningWas = lightningOn();
  state.preferences.settings.subscribe(() => {
    const now = lightningOn();
    if (now === lightningWas) return;
    lightningWas = now;
    lightningStart();
  });
  // Once a day, as long as it is not solved: a key ended or refused.
  setTimeout(checkKeys, 45_000);
  setInterval(checkKeys, 3_600_000);
  // Once a week: has SOCIB changed its instruments?
  setTimeout(() => {
    void import('./socibWatch.ts').then(({ checkSocib }) => checkSocib());
  }, 20_000);
  setInterval(() => {
    // At midnight, alerts switched off come back on, if so chosen.
    void import('./windReOn.ts').then(({ applyReOn }) => applyReOn('tick'));
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
  // Every station within 60 km of the GPS position is recorded, all its
  // data, for the trends of LiveMétéo and the alerts wherever the boat is,
  // in the background too while the device lets NavIn run.
  setTimeout(record, 30_000);
  setInterval(record, RECORD_EVERY_MS);
}

/** Time for the map to reach the new zone before the wind is read there. */
const ZONE_SETTLE_MS = 1500;

/** The stations around the boat are recorded this often. */
const RECORD_EVERY_MS = 10 * 60_000;

function checkKeys(): void {
  void import('./keyHealth.ts')
    .then(({ dailyKeyCheck }) => dailyKeyCheck())
    .catch(() => undefined);
}

function record(): void {
  void import('./liveRecorder.ts')
    .then(({ recordAround }) => recordAround())
    .catch(() => undefined);
}

function alertsOn(): boolean {
  return windAlertConfig(state.preferences.settings.value).on || lightningOn();
}

function lightningOn(): boolean {
  const lightning = state.preferences.settings.value.lightning as
    { on?: boolean } | undefined;
  // On unless switched off.
  return lightning?.on !== false;
}

function lightningStart(): void {
  void import('./lightningWatch.ts')
    .then(({ lightningWatchStart }) => lightningWatchStart())
    .catch(() => undefined);
}
