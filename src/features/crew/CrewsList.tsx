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
  state,
} from '../../state/index.ts';
import { ListPublishRow } from '../publish/index.ts';

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
  const sets = state.data.crewSets.value.toSorted((first, second) =>
    crewSetName(first).localeCompare(crewSetName(second), 'fr'),
  );
  const crewCount = cruise?.crew.length ?? 0;
  const names = (cruise?.crew ?? [])
    .map((line) => line.nom)
    .filter(Boolean)
    .join(', ');
  return (
    <>
      <PageTitle>Équipages</PageTitle>
      {cruise ? (
        <>
          <h2 className="sub-h">{tr('À bord maintenant')}</h2>
          <ButtonRow>
            <Button
              className="btn big"
              id="csAboard"
              onClick={() => {
                buzz();
                go('crew');
              }}
            >
              {tr(
                `⛵ Équipage à bord · ${crewCount} personne${crewCount > 1 ? 's' : ''}`,
              )}
              <small>{names || tr('personne pour l’instant')}</small>
            </Button>
          </ButtonRow>
          <h2 className="sub-h">{tr('Équipages enregistrés')}</h2>
        </>
      ) : null}
      {sets.length > 0 ? (
        <ButtonRow className="row prep-col">
          {sets.map((set) => (
            <SetButton key={set.id} className="btn big" set={set} />
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
