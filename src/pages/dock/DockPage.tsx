import { useSignals } from '@preact/signals-react/runtime';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { depthAt } from '../../features/map/index.ts';
import {
  dockDone,
  moorNow,
  toggleDockPoint,
} from '../../features/prep/moor.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { herePos, isLake, state } from '../../state/index.ts';

const DOCK_STEPS = [
  'Pare-battages en place, à la bonne hauteur',
  'Amarres avant et arrière préparées, lovées, tournées au taquet',
  'Gaffe à portée de main',
  'Voiles affalées et rangées',
  'Moteur : marche avant et arrière essayées, vitesse réduite',
  'Équipiers briefés : qui débarque, qui tient quelle amarre',
  'Personne entre le bateau et le quai',
];

/**
 * Screen `dock`: water depth here and what to prepare before docking (legacy
 * `VIEWS.dock`, prep.js:726).
 * @returns The docking checklist.
 */
export function DockPage() {
  useSignals();
  const here = herePos();
  const depth = here ? depthAt(here.lat, here.lon) : '';
  const sea = state.data.cruise.value !== null && !isLake();
  const steps = sea
    ? [...DOCK_STEPS, 'VHF sur le canal du port, place demandée']
    : DOCK_STEPS;
  const done = dockDone.value;
  return (
    <>
      <h1>⚓ Accostage</h1>
      <FoldSection title="Hauteur d’eau ici">
        <div className="value" style={{ fontSize: 34 }}>
          {depth || '–'}
        </div>
        <HelpText>
          {depth
            ? 'D’après les isobathes de la carte, à vérifier au sondeur.'
            : 'Pas de courbe de profondeur à proximité : fiez-vous au sondeur et à la carte.'}
        </HelpText>
      </FoldSection>
      <FoldSection title="À préparer">
        <div className="dock-list">
          {steps.map((text, position) => (
            <Button
              key={text}
              className={`btn dock-it ${done[position] ? 'on' : ''}`}
              data-i={position}
              onClick={() => {
                buzz();
                toggleDockPoint(position);
              }}
            >
              {done[position] ? '✔ ' : ''}
              {text}
            </Button>
          ))}
        </div>
      </FoldSection>
      <div className="row c2">
        <PageBack
          label="◀ NavIn"
          className="btn big"
          data-d="back"
          onClick={() => {
            buzz();
            go('tracker');
          }}
        />
        <ArmedButton
          className="btn big danger"
          data-d="moor"
          armedLabel="Toucher encore : amarré"
          onClick={buzz}
          onConfirm={() => void moorNow()}
        >
          🔒 Amarrage
          <small>fin de la trace, check-out</small>
        </ArmedButton>
      </div>
    </>
  );
}
