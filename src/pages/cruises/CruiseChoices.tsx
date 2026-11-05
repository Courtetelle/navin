import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ZONES } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { boatSub } from '../../model/boatSheet.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

import { newBoat, newZone } from './newCruiseForm.ts';

const PURPOSES = [
  ['Entraînement', '🎯', 'entre membres'],
  ['Location', '🔑', 'tarif calculé'],
  ['Invitation', '🤝', 'invités à bord'],
] as const;

/** Props shared by the choices of the form. */
interface ChoiceProps {
  /** Run a choice that redraws the screen. */
  onRedraw: (change: () => void) => void;
}

/** Props of {@link BoatChoice}. */
export interface BoatChoiceProps extends ChoiceProps {
  /** Boat chosen. */
  boatId: string | null;
}

/**
 * Boat of a lake navigation.
 * @param props - Boat chosen and redraw function.
 * @returns The title and the boats.
 */
export function BoatChoice({ boatId, onRedraw }: BoatChoiceProps) {
  useSignals();
  const tr = useTr();
  const boats = state.data.boats.value;
  return (
    <>
      <h3 className="sub-h">{tr('Quel bateau ?')}</h3>
      <ButtonRow className={boats.length > 1 ? 'row c2' : 'row'}>
        {boats.map((boat) => {
          const sub = boatSub(boat.info);
          return (
            <Button
              key={boat.id}
              className={boat.id === boatId ? 'btn big on' : 'btn big'}
              data-boat={boat.id}
              onClick={() => {
                onRedraw(() => {
                  newBoat.value = boat.id;
                });
              }}
            >
              {`🚤 ${boat.info.boat || 'Sans nom'}`}
              {sub ? <small>{sub}</small> : null}
            </Button>
          );
        })}
      </ButtonRow>
      <ButtonRow>
        <Button
          className="btn"
          data-go-boats="1"
          onClick={() => {
            buzz();
            go('boats');
          }}
        >
          {tr('＋ Nouveau bateau / modifier mes bateaux')}
        </Button>
      </ButtonRow>
    </>
  );
}

/**
 * Purpose of a lake day outing.
 * @param props - Redraw function.
 * @returns The title and the purposes.
 */
export function PurposeChoice({ onRedraw }: ChoiceProps) {
  useSignals();
  const tr = useTr();
  const chosen = state.view.newPurpose.value;
  return (
    <>
      <h3 className="sub-h">{tr('Quel type de sortie ?')}</h3>
      <ButtonRow className="row c3">
        {PURPOSES.map(([purpose, icon, sub]) => (
          <Button
            key={purpose}
            className={purpose === chosen ? 'btn big on' : 'btn big'}
            data-purpose={purpose}
            onClick={() => {
              onRedraw(() => {
                state.view.newPurpose.value = purpose;
              });
            }}
          >
            {tr(`${icon} ${purpose}`)}
            <small>{tr(sub)}</small>
          </Button>
        ))}
      </ButtonRow>
    </>
  );
}

/** Props of {@link ZoneChoice}. */
export interface ZoneChoiceProps extends ChoiceProps {
  /** Sea area chosen. */
  zone: string;
}

/**
 * Sea area of a cruise.
 * @param props - Area chosen and redraw function.
 * @returns The title and the areas.
 */
export function ZoneChoice({ zone, onRedraw }: ZoneChoiceProps) {
  const tr = useTr();
  return (
    <>
      <h3 className="sub-h">{tr('Plan d’eau')}</h3>
      <ButtonRow className="row c2">
        {ZONES.map(([code, label]) => (
          <Button
            key={code}
            className={code === zone ? 'btn on' : 'btn'}
            data-zone={code}
            onClick={() => {
              onRedraw(() => {
                newZone.value = code;
              });
            }}
          >
            {tr(`${code} · ${label}`)}
          </Button>
        ))}
      </ButtonRow>
    </>
  );
}
