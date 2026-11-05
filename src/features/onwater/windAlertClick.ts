import { state, toast, updateSettings } from '../../state/index.ts';

import { refreshLakeButtons } from './lakeRefresh.ts';
import { unlockAudio } from './windAudio.ts';
import { windTestToggle } from './windTest.ts';
import {
  resetWindSignal,
  windCheck,
  windConfig,
  windMuted,
  windWatchStart,
} from './windWatch.ts';

/** Buttons of the wind alert block (`data-walert`). */
export type WindAlertAction = 'toggle' | 'mute' | 'basis' | 'test';

/**
 * Handle a touch on a button of the wind alert block (legacy `windAlertClick`).
 * @param action - Button touched.
 */
export function windAlertClick(action: WindAlertAction): void {
  const config = windConfig();
  unlockAudio();
  if (action === 'test') {
    windTestToggle();
    return;
  }
  if (action === 'mute') {
    toggleMute();
    return;
  }
  if (action === 'toggle') {
    const on = !config.on;
    updateSettings((settings) => {
      settings.windAlert = { ...config, on };
    });
    if (on && !state.preferences.settings.value.wake) {
      toast('Conseil : ⚙︎ › Garder l’écran allumé : OUI');
    }
    resetWindSignal();
    windWatchStart();
  } else {
    const basis = config.basis === 'gust' ? 'avg' : 'gust';
    updateSettings((settings) => {
      settings.windAlert = { ...config, basis };
    });
    resetWindSignal();
    windCheck();
  }
  refreshLakeButtons();
}

function toggleMute(): void {
  if (windMuted()) {
    updateSettings((settings) => {
      settings.windMuteTrack = false;
    });
    toast('Alertes de vent de nouveau actives');
    return;
  }
  if (!state.view.tracking.value) {
    toast('Aucune trace en cours : les alertes restent actives');
    return;
  }
  updateSettings((settings) => {
    settings.windMuteTrack = true;
  });
  toast('Alertes de vent coupées jusqu’à la fin de la trace');
}
