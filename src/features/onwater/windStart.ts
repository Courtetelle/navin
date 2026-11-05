import { state } from '../../state/index.ts';

import { resumeAudio, unlockAudio } from './windAudio.ts';
import { windAlertConfig } from './windLogic.ts';

/**
 * Start the wind watch shortly after boot: alerts work on every screen, with
 * or without an open cruise. Sound can only be unlocked by a touch. The watch
 * loads apart so a failure in the weather code never reaches the boot.
 */
export function startWindWatch(): void {
  document.addEventListener(
    'pointerdown',
    () => {
      if (alertsOn()) unlockAudio();
    },
    { passive: true },
  );
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
}

function alertsOn(): boolean {
  return windAlertConfig(state.preferences.settings.value).on;
}
