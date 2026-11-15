import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { boatsByNav } from '../../features/boats/index.ts';
import { pickBoat } from '../../features/prep/prepPicks.ts';
import { buzz } from '../../lib/dom.ts';
import { boatSub } from '../../model/boatSheet.ts';
import type { Boat } from '../../model/types.ts';
import { go } from '../../shell/router.ts';

import type { PrepStepProps } from './PrepFirstSteps.tsx';
import { PrepNav } from './PrepNav.tsx';

/**
 * The boat, from the list of the boats, at sea as on a lake.
 * @param props - PréP flow.
 * @returns The choices.
 */
export function PrepBoatStep({ prep }: PrepStepProps) {
  return <BoatList prep={prep} />;
}

function BoatList({ prep }: PrepStepProps) {
  useSignals();
  const list = boatsByNav(prep.purpose ?? undefined);
  return (
    <>
      {list.length > 0 ? (
        <div className="row prep-col">
          {list.map((boat) => (
            <BoatPick key={boat.id} boat={boat} on={prep.boatId === boat.id} />
          ))}
        </div>
      ) : (
        <HelpText nextIsRow>Aucun bateau enregistré.</HelpText>
      )}
      <div className="row">
        <Button
          className="btn"
          data-p="boats"
          onClick={() => {
            buzz();
            go('boats');
          }}
        >
          ➕ Ajouter ou modifier un bateau
        </Button>
      </div>
      <PrepNav />
    </>
  );
}

function BoatPick({ boat, on }: { boat: Boat; on: boolean }) {
  const press = useLongPress(() => go('boats', boat.id));
  const classes = ['btn big', on ? 'on' : '', press.hit ? 'lp-hit' : ''];
  return (
    <Button
      className={classes.filter(Boolean).join(' ')}
      data-pick="boatId"
      data-v={boat.id}
      {...press.handlers}
      onClick={() => pickBoat(boat.id)}
    >
      🚤 {boat.info.boat || 'Bateau'}
      <small>{boatSub(boat.info)}</small>
    </Button>
  );
}
