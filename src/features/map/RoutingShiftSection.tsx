import { useSignals } from '@preact/signals-react/runtime';

import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import type { ShiftPrefs } from './routingShift.ts';
import { SHIFT_STEPS, saveShiftPrefs, shiftPrefs } from './routingShift.ts';

function stepName(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`;
}

/**
 * Paramétrages › Routages: how the ◀ ▶ arrows beside a routing shown on the
 * map move it, by how many minutes, its ETD or its ETA.
 * @returns The section.
 */
export function RoutingShiftSection() {
  useSignals();
  const tr = useTr();
  const prefs = shiftPrefs.value;
  return (
    <div className="field rtg-form" id="rtgShiftPrefs">
      <label htmlFor="rtgStep">{tr('Incrément des flèches ◀ ▶')}</label>
      <select
        id="rtgStep"
        value={prefs.stepMin}
        onChange={(event) => {
          buzz();
          saveShiftPrefs({ ...prefs, stepMin: Number(event.target.value) });
        }}
      >
        {SHIFT_STEPS.map((minutes) => (
          <option key={minutes} value={minutes}>
            {stepName(minutes)}
          </option>
        ))}
      </select>
      <label htmlFor="rtgMoves">{tr('Les flèches décalent')}</label>
      <select
        id="rtgMoves"
        value={prefs.moves}
        onChange={(event) => {
          buzz();
          saveShiftPrefs({
            ...prefs,
            moves: event.target.value === 'eta' ? 'eta' : 'etd',
          } satisfies ShiftPrefs);
        }}
      >
        <option value="etd">{tr('l’heure de départ (ETD)')}</option>
        <option value="eta">{tr('l’heure d’arrivée (ETA)')}</option>
      </select>
      <HelpText>
        {tr(
          'Un routage affiché sur la carte a trois boutons à droite : ◀ et ▶ décalent l’ETD (ou l’ETA, le départ étant alors recalculé) de l’incrément choisi et refont le routage avec la météo des nouvelles heures. Le bouton du milieu montre l’ETD, l’ETA et ce qui change ; le toucher revient au routage calculé, un appui long cherche le meilleur départ du jour (le plus rapide, le moteur comptant moitié plus).',
        )}
      </HelpText>
    </div>
  );
}
