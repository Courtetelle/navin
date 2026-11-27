import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { CrewSet } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import {
  crewSetDate,
  crewSetName,
  crewSetPeople,
  openVoyage,
  state,
  updateCrewSets,
} from '../../state/index.ts';
import { inMenuOrder } from '../data/dataOrder.ts';
import { SwipeRow } from '../prep/index.ts';
import { ListPublishRow, openListPublish } from '../publish/index.ts';

import { beginCrewSetEdit } from './crewsEdit.ts';
import { showCrewsEdit } from './screen.ts';

/**
 * The saved compositions, with the crew on board first during a navigation
 * (legacy `VIEWS.crews`, prep.js:770).
 * @returns The screen.
 */
export function CrewsList() {
  useSignals();
  const tr = useTr();
  const cruise = state.data.cruise.value;
  const sets = inMenuOrder(
    'crews',
    state.data.crewSets.value,
    (set) => set.id,
    (set) => crewSetName(set),
  );
  const store = state.data.voyageStore.value;
  const voyage = store.list.find((item) => item.id === store.active);
  const chosen = voyage?.crewSet
    ? state.data.crewSets.value.find((set) => set.id === voyage.crewSet)
    : undefined;
  const word = voyage?.lake ? 'sortie' : 'croisière';
  const openActive = (): void => {
    if (!voyage) return;
    buzz();
    openVoyage(voyage.id);
    go('vcrew');
  };
  return (
    <>
      <PageTitle sort="crews">Équipages</PageTitle>
      <h2 className="sub-h">{tr('À bord maintenant')}</h2>
      {voyage ? (
        <ButtonRow>
          <Button
            className={`btn big ${chosen ? 'on' : ''}`}
            id="csAboard"
            data-aboard={chosen?.id ?? ''}
            onClick={openActive}
          >
            {chosen
              ? `👥 ${crewSetName(chosen)}`
              : tr('👥 Aucun équipage choisi')}
            <small>
              {chosen
                ? `${crewSetPeople(chosen)} · ${tr(`${word} active`)} « ${voyage.name} »`
                : tr(
                    `à choisir dans la ${word} active « ${voyage.name} » › Équipage`,
                  )}
            </small>
          </Button>
        </ButtonRow>
      ) : (
        <ButtonRow>
          <Button
            className="btn big"
            id="csAboard"
            onClick={() => {
              buzz();
              go('voyages');
            }}
          >
            {tr('👥 Aucune croisière ni sortie active')}
            <small>
              {tr(
                'l’équipage à bord se choisit dans la croisière ou la sortie active › Équipage',
              )}
            </small>
          </Button>
        </ButtonRow>
      )}
      {cruise && !chosen && cruise.crew.length > 0 ? (
        <HelpText>
          {`${tr('Navigation en cours')} : ${cruise.crew
            .map((line) => line.nom)
            .filter(Boolean)
            .join(', ')}`}
        </HelpText>
      ) : null}
      <h2 className="sub-h">{tr('Équipages enregistrés')}</h2>
      {sets.length > 0 ? (
        <ButtonRow className="row prep-col">
          {sets.map((set) => (
            <SwipeRow
              key={set.id}
              id={set.id}
              name={crewSetName(set)}
              onShare={(format) => openListPublish('crews', set.id, format)}
              onDelete={(id) => {
                updateCrewSets((list) => {
                  const index = list.findIndex((item) => item.id === id);
                  if (index !== -1) list.splice(index, 1);
                });
              }}
            >
              <SetButton
                className={`btn big ${set.id === chosen?.id ? 'primary' : ''}`}
                set={set}
              />
            </SwipeRow>
          ))}
        </ButtonRow>
      ) : (
        <div className="row prep-col">
          <HelpText>Aucun équipage pour l’instant.</HelpText>
        </div>
      )}
      <ButtonRow style={{ marginTop: 12 }}>
        <Button
          className="btn big primary"
          id="csNew"
          onClick={() => {
            buzz();
            state.view.crewsEdit.value = {
              id: null,
              name: '',
              crew: [],
              editing: true,
            };
            showCrewsEdit();
          }}
        >
          {tr('＋ Nouvel équipage')}
        </Button>
      </ButtonRow>
      {sets.length > 0 ? <ListPublishRow kind="crews" /> : null}
    </>
  );
}

function SetButton({ set, className }: { set: CrewSet; className: string }) {
  const tr = useTr();
  const people = [set.name ? set.ident : '', crewSetPeople(set)]
    .filter(Boolean)
    .join(' · ');
  const date = crewSetDate(set);
  return (
    <Button
      className={className}
      data-cs={set.id}
      onClick={() => {
        buzz();
        if (beginCrewSetEdit(set.id)) showCrewsEdit();
      }}
    >
      {`👥 ${crewSetName(set)}`}
      <small>
        {people || tr('vide')}
        {date ? (
          <>
            <br />
            {tr(date)}
          </>
        ) : null}
      </small>
    </Button>
  );
}
