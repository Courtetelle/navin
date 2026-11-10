import { signal } from '@preact/signals-react';

import { BEAUFORT_TBL, BFT_KN } from '../../model/lists.ts';

import { playAlarm } from './windAudio.ts';
import { WIND_POP_DELAY, testSeaTxt, waveOmmTxt } from './windLogic.ts';
import { clearWindOverlays, showWindPopup } from './windOverlayState.ts';

/** The alert test is running (legacy `windTest`). */
export const windTestRunning = signal(false);

const LAST_LEVEL = 8;

let timer: ReturnType<typeof setTimeout> | undefined;

/** Stop the alert test and clear the screen (legacy `windTestStop`). */
export function windTestStop(): void {
  clearTimeout(timer);
  windTestRunning.value = false;
  clearWindOverlays();
}

/**
 * Start the alert test, or stop it when running: each level beeps and flashes,
 * then shows the bubble; a touch on the bubble goes to the next level.
 */
export function windTestToggle(): void {
  if (windTestRunning.value) {
    windTestStop();
    return;
  }
  windTestRunning.value = true;
  playLevel(0);
}

function playLevel(level: number): void {
  if (!windTestRunning.value) return;
  if (level > LAST_LEVEL) {
    windTestStop();
    return;
  }
  const force = level + 4;
  // Gusts are about 1.4 times the mean wind.
  const other = `vent moyen ${Math.round((BFT_KN[force - 1] as number) / 1.4)} nd`;
  playAlarm(level, undefined, { other });
  timer = setTimeout(() => {
    if (!windTestRunning.value) return;
    showWindPopup({
      bf: force,
      kn: `${BEAUFORT_TBL[force]?.[1]} nd`,
      other,
      where: 'essai',
      sea: testSeaTxt(force),
      omm: waveOmmTxt(force),
      note: 'Essai : la valeur du modèle est inventée pour l’exemple. En navigation, elle vient des stations de mesure autour du bateau, ou à défaut d’un modèle de prévision, signalé « PRÉVISION ».',
      closeTxt:
        level + 1 > LAST_LEVEL
          ? 'Toucher pour fermer'
          : 'Toucher pour le niveau suivant',
      onStop: windTestStop,
      onClose: () => playLevel(level + 1),
    });
  }, WIND_POP_DELAY);
}
