import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { pickTarif } from '../../features/prep/prepPicks.ts';
import type { PrepTarif } from '../../features/prep/prepTarif.ts';
import { prepTarifSuggest, prepTarifs } from '../../features/prep/prepTarif.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import type { Boat } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import { boatById } from '../../state/index.ts';

import type { PrepStepProps } from './PrepFirstSteps.tsx';
import { PrepNav } from './PrepNav.tsx';

/**
 * The fare of a rental: the fares of the boat, the one of the moment proposed.
 * @param props - PréP flow.
 * @returns The fares.
 */
export function PrepTarifStep({ prep }: PrepStepProps) {
  useSignals();
  const boat = prep.boatId ? boatById(prep.boatId) : undefined;
  const list = prepTarifs(boat);
  const rules = textOf(boat?.info.reglement);
  const rental = /location/i.test(rules)
    ? rules
        .split('\n')
        .filter((line) => /location|franchise/i.test(line))
        .join(' ')
    : null;
  return (
    <>
      {list.length > 0 ? (
        <TarifList boat={boat} list={list} chosen={prep.tarif} />
      ) : (
        <NoTarif name={boat?.info.boat || 'ce bateau'} />
      )}
      {rental === null ? null : (
        <HelpText className="prep-regl" nextIsRow>
          {rental}
        </HelpText>
      )}
      {/* A fare touched goes on by itself: « Suivant » only without fares. */}
      <PrepNav next={list.length > 0 ? '' : 'Suivant ▶'} />
    </>
  );
}

interface TarifListProps {
  boat: Boat | undefined;
  list: readonly PrepTarif[];
  chosen: string | null | undefined;
}

function TarifList({ boat, list, chosen }: TarifListProps) {
  const { tarif, why } = prepTarifSuggest(boat);
  const text = `Proposé pour aujourd’hui (${why}) : ${tarif ? tarif.label : 'aucun tarif ne correspond'}. Touchez le bon tarif.`;
  return (
    <>
      <HelpText text={text} nextIsRow>
        <>
          Proposé pour aujourd’hui ({why}) :{' '}
          {tarif ? <b>{tarif.label}</b> : 'aucun tarif ne correspond'}. Touchez
          le bon tarif.
        </>
      </HelpText>
      <div className="row prep-col">
        {list.map((item) => (
          <Button
            key={item.index}
            // Only a fare chosen is lit; the proposed one just says so.
            className={`btn big ${chosen === item.label ? 'on' : ''}`}
            data-tarif={item.index}
            onClick={() => pickTarif(item.index)}
          >
            💶 {item.label}
            <small>
              {item.price || item.line}
              {tarif?.index === item.index ? ' · proposé' : ''}
            </small>
          </Button>
        ))}
      </div>
      <div className="row">
        <Button
          className="btn"
          data-tarif="none"
          onClick={() => pickTarif(null)}
        >
          Sans tarif (gratuit ou à régler autrement)
        </Button>
      </div>
    </>
  );
}

function NoTarif({ name }: { name: string }) {
  return (
    <>
      <HelpText nextIsRow>
        {`Aucun tarif dans la fiche de ${name}. On peut les ajouter dans Mes bateaux, rubrique « Tarifs ».`}
      </HelpText>
      <div className="row">
        <Button
          className="btn"
          data-p="boats"
          onClick={() => {
            buzz();
            go('boats');
          }}
        >
          ➕ Ajouter les tarifs du bateau
        </Button>
      </div>
    </>
  );
}
