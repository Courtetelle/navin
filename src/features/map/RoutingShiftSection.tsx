import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import {
  RANK_SPANS,
  SHIFT_STEPS,
  saveShiftPrefs,
  shiftPrefs,
} from './routingShift.ts';

function stepName(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`;
}

/**
 * Paramétrages › Routages: how the ▲ ▼ arrows beside a routing shown on the
 * map move its ETD, by how many minutes, and over how many next hours the
 * routings are sorted by efficiency. Big buttons, easy
 * to touch on a boat that pitches and heels.
 * @returns The section.
 */
export function RoutingShiftSection() {
  useSignals();
  const tr = useTr();
  const prefs = shiftPrefs.value;
  return (
    <div className="field" id="rtgShiftPrefs">
      <p className="keep-help nav-hint">{tr('Incrément des flèches ▲ ▼')}</p>
      <ButtonRow className="row c3 rtg-steps">
        {SHIFT_STEPS.map((minutes) => (
          <Button
            key={minutes}
            type="button"
            className={minutes === prefs.stepMin ? 'btn on' : 'btn'}
            aria-pressed={minutes === prefs.stepMin}
            data-step={minutes}
            onClick={() => {
              buzz();
              saveShiftPrefs({ ...prefs, stepMin: minutes });
            }}
          >
            {stepName(minutes)}
          </Button>
        ))}
      </ButtonRow>
      <p className="keep-help nav-hint">
        {tr('Plage du classement des routages les plus efficients')}
      </p>
      <ButtonRow className="row c3 rtg-spans">
        {RANK_SPANS.map((hours) => (
          <Button
            key={hours}
            type="button"
            className={hours === prefs.rankHours ? 'btn on' : 'btn'}
            aria-pressed={hours === prefs.rankHours}
            data-span={hours}
            onClick={() => {
              buzz();
              saveShiftPrefs({ ...prefs, rankHours: hours });
            }}
          >
            {tr(`${hours} prochaines heures`)}
          </Button>
        ))}
      </ButtonRow>
      <HelpText>
        {tr(
          'Un routage affiché sur la carte a ses boutons à droite. Le bouton du milieu donne le routage « Départ imminent » : en partant maintenant, refait toutes les 10 minutes ; ▼ est alors grisé. ▲ décale le départ de l’incrément choisi et refait le routage avec la météo des nouvelles heures ; le bouton devient « Départ à 21h30 », le toucher revient à « Départ imminent ». ▼ avance le départ, jamais avant maintenant. Un appui long sur le bouton du milieu le met en vert : les routages de la plage choisie (6, 12 ou 24 prochaines heures) sont triés du plus efficient (le plus rapide, le moteur comptant moitié plus) au moins efficient, ▼ et ▲ passent de l’un à l’autre, un toucher revient au plus efficient, un nouvel appui long en sort. En départ imminent, le bouton 🌬⚡ affiche par-dessus le vent mesuré (LiveMétéo) et les orages détectés. Les chiffres du routage sont sur une étiquette à déplacer du doigt. Un appui long sur une flèche ouvre ces réglages.',
        )}
      </HelpText>
    </div>
  );
}
