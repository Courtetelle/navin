import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import type { ShiftPrefs } from './routingShift.ts';
import { SHIFT_STEPS, saveShiftPrefs, shiftPrefs } from './routingShift.ts';

function stepName(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`;
}

const MOVES: ReadonlyArray<[ShiftPrefs['moves'], string]> = [
  ['etd', 'Départ (ETD)'],
  ['eta', 'Arrivée (ETA)'],
];

/**
 * Paramétrages › Routages: how the ▲ ▼ arrows beside a routing shown on the
 * map move it, by how many minutes, its ETD or its ETA. Big buttons, easy
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
      <p className="keep-help nav-hint">{tr('Les flèches décalent')}</p>
      <ButtonRow className="row c2 rtg-moves">
        {MOVES.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            className={key === prefs.moves ? 'btn on' : 'btn'}
            aria-pressed={key === prefs.moves}
            data-moves={key}
            onClick={() => {
              buzz();
              saveShiftPrefs({ ...prefs, moves: key });
            }}
          >
            {tr(label)}
          </Button>
        ))}
      </ButtonRow>
      <HelpText>
        {tr(
          'Un routage affiché sur la carte a trois boutons à droite. ▲ et ▼ décalent l’ETD ou l’ETA de l’incrément choisi et refont le routage avec la météo des nouvelles heures (en ETA, le départ est recalculé). Toucher l’étiquette ETD ou ETA sur la carte la choisit : elle clignote trois fois et les flèches agissent sur elle. Le bouton du milieu montre ce qui change ; le toucher revient au routage calculé. Un appui long le met en vert : les routages du jour sont triés du plus efficient (le plus rapide, le moteur comptant moitié plus) au moins efficient, ▼ et ▲ passent de l’un à l’autre, un toucher revient au plus efficient, un nouvel appui long revient au tri par heure. Un appui long sur une flèche ouvre ces réglages.',
        )}
      </HelpText>
    </div>
  );
}
