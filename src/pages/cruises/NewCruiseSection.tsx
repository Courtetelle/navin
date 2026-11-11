import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import { autoOutingName } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import type { ModeKey } from '../../model/modes.ts';
import { MODES } from '../../model/modes.ts';
import { state } from '../../state/index.ts';

import {
  BoatChoice,
  KeepBoatRow,
  KeepCrewRow,
  PurposeChoice,
  ZoneChoice,
} from './CruiseChoices.tsx';
import { createCruise } from './createCruise.ts';
import {
  keepBoat,
  keptBoatName,
  nameText,
  nameWithKeptBoat,
  newBoat,
  newPlace,
  placeSearching,
  placeText,
  zoneNow,
} from './newCruiseForm.ts';

const NAME_HELP =
  'Nom automatique : n° de la sortie dans l’année, plan d’eau, bateau, port et date. Vous pouvez le changer ici ou plus tard dans « Bateau et croisière ».';
const MODE_HELP: Readonly<Record<ModeKey, string>> = {
  mer: 'Check-list de prise du bateau en début de location, puis de restitution. Chaque croisière a son journal, ses fiches du jour, son équipage et sa trace.',
  lacj: 'Check-list d’arrivée à bord à chaque sortie. Les données du bateau sont reprises de « Mes bateaux ».',
  lacc: 'Check-list d’arrivée à bord en début de croisière, et de fin de croisière. Une fiche par jour.',
};
const WORDS: Readonly<Record<ModeKey, string>> = {
  mer: 'croisière',
  lacj: 'sortie',
  lacc: 'croisière sur le lac',
};
/** Props of {@link NewCruiseSection}. */
interface NewCruiseSectionProps {
  /** Mode of the new navigation. */
  mode: ModeKey;
  /** Run a choice that redraws the screen. */
  onRedraw: (change: () => void) => void;
}

/**
 * Form of a new navigation (legacy `VIEWS.cruises`): boat, type or sea area,
 * place of departure, automatic name, what to take over from the open cruise.
 * @param props - Mode and redraw function.
 * @returns The folding section.
 */
export function NewCruiseSection({ mode, onRedraw }: NewCruiseSectionProps) {
  useSignals();
  const tr = useTr();
  const nameField = useRef<HTMLInputElement>(null);
  const placeField = useRef<HTMLInputElement>(null);
  useMarquee(nameField);
  useMarquee(placeField);
  const cruise = state.data.cruise.value;
  const boats = state.data.boats.value;
  const lake = mode !== 'mer';
  const word = WORDS[mode];
  const zone = zoneNow();
  const boatId =
    !lake || boats.some((boat) => boat.id === newBoat.value)
      ? newBoat.value
      : (boats[0]?.id ?? null);
  useLayoutEffect(() => {
    if (lake) newBoat.value = boatId;
  }, [lake, boatId]);
  const boat = boats.find((item) => item.id === boatId);
  const showKeepBoat = Boolean(cruise) && mode === 'mer';
  const keptBoat = showKeepBoat && keepBoat.value ? cruise : null;
  const autoName = (withKeptBoat: boolean) => {
    const name = lake ? boat?.info.boat : keptBoatName(keptBoat, withKeptBoat);
    return autoOutingName(mode, name || '', newPlace.value || '', zone);
  };
  const nameDirty = state.view.nameDirty.value;
  const shownName = nameDirty
    ? nameText.value
    : autoName(nameWithKeptBoat.value);

  const create = () => {
    const created = createCruise({
      mode,
      boat,
      name: shownName.trim() || autoName(true),
      zone,
      fromCruise: keptBoat,
    });
    if (!created) nameField.current?.focus();
  };

  return (
    <FoldSection title={`${MODES[mode].icon} Nouvelle ${word}`}>
      {lake ? <BoatChoice boatId={boatId} onRedraw={onRedraw} /> : null}
      {mode === 'lacj' ? <PurposeChoice onRedraw={onRedraw} /> : null}
      {mode === 'mer' ? <ZoneChoice zone={zone} onRedraw={onRedraw} /> : null}
      <h3 className="sub-h">{tr('Port de départ')}</h3>
      <input
        className="text"
        id="newPlace"
        ref={placeField}
        type="text"
        value={placeText.value}
        placeholder={tr.placeholder(
          placeSearching.value ? 'Recherche GPS…' : 'ex. Morges',
        )}
        onChange={(event) => {
          placeText.value = event.target.value;
          newPlace.value = event.target.value.trim();
          nameWithKeptBoat.value = true;
        }}
      />
      <h3 className="sub-h">{tr('Nom')}</h3>
      <input
        className="text"
        id="newName"
        ref={nameField}
        type="text"
        value={shownName}
        placeholder={tr.placeholder(`Nom de la ${word}`)}
        onChange={(event) => {
          nameText.value = event.target.value;
          state.view.nameDirty.value = true;
        }}
      />
      <HelpText style={{ marginTop: '4px' }}>{NAME_HELP}</HelpText>
      {showKeepBoat ? <KeepBoatRow /> : null}
      {cruise ? <KeepCrewRow /> : null}
      <ButtonRow>
        <Button className="btn big primary" id="createBtn" onClick={create}>
          {tr('＋ Créer et ouvrir')}
        </Button>
      </ButtonRow>
      <HelpText>{MODE_HELP[mode]}</HelpText>
    </FoldSection>
  );
}
