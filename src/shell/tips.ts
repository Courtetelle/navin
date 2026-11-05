import { signal } from '@preact/signals-react';

import { state, toast } from '../state/index.ts';
import { store } from '../storage/store.ts';

/** Element highlighted by the boot tip: a tab key, `gear` or `clock`. */
export const tipFocus = signal<string | null>(null);

const TIPS: ReadonlyArray<readonly [string | null, string]> = [
  [
    'tracker',
    'NavIn : touchez plusieurs fois pour faire défiler ses choix (PréP, START, Téléphone ou VHF) · appui long sur un choix : il se lance · appui long sur le logo : change la zone de navigation',
  ],
  [
    'more',
    'data : toutes vos fiches · bateaux, coéquipiers·ères, équipages, check-lists, traces, cartes et documents',
  ],
  [
    'sos',
    'SOS : un toucher ouvre les outils de secours de la zone · homme à la mer, alphabet, téléphone ou VHF',
  ],
  ['gear', 'Curseurs : les réglages · appui long : mode nuit ou mode jour'],
  [
    'clock',
    'L’heure : en mer elle s’affiche en UTC · un toucher montre 5 secondes l’heure locale (Zone Time)',
  ],
  [
    null,
    'Les bulles se déplacent au doigt · un toucher les ferme · les pastilles d’aide « i » se masquent dans les réglages (Zone et écran)',
  ],
];

/**
 * 1.5 s after the start, one tip presents a button of the top bar, the next
 * one at the next start, each once (prep.js:234-251, index in `ldb.tipIdx`).
 * @returns Cancels the pending tip.
 */
export function scheduleBootTip(): () => void {
  const timer = setTimeout(showBootTip, 1500);
  return () => clearTimeout(timer);
}

function showBootTip(): void {
  if (state.view.tracking.value || state.preferences.settings.value.noHelpI) {
    return;
  }
  const index = Number(store.raw('ldb.tipIdx') || 0) || 0;
  const tip = TIPS[index];
  if (!tip) return;
  store.setRaw('ldb.tipIdx', String(index + 1));
  const [target, message] = tip;
  toast(message);
  if (!target) return;
  tipFocus.value = target;
  setTimeout(() => {
    if (tipFocus.value === target) tipFocus.value = null;
  }, 6000);
}
