import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { CheckBanner } from '../../features/checklists/index.ts';
import { saveDraftAsEntry } from '../../features/logbook/entryActions.ts';
import {
  LakeButtons,
  lakeState,
  sailHidden,
} from '../../features/onwater/index.ts';
import { AutoCard } from '../../features/tracking/index.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey } from '../../lib/format.ts';
import { SAIL_KEYS } from '../../model/fields.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import { activeFields, crewNames, setDraft, state } from '../../state/index.ts';

import { EntryField } from './EntryField.tsx';

/**
 * Screen `new`: the hourly form with big cards, almost without keyboard (legacy
 * `VIEWS.new`); it also edits an entry of the journal.
 * @returns The screen content.
 */
export function NewPage() {
  useSignals();
  useNavFields();
  const [generation, setGeneration] = useState(0);
  const draft = state.data.draft.value;
  if (!draft) return null;
  const editing = Boolean(draft.id);
  const lake = editing ? null : lakeState(dayKey(new Date()));
  const prefilled = Boolean(draft.prefilled) && !editing;
  const fields = activeFields().filter(
    (field) => field.type !== 'crew' || crewNames().length > 0,
  );
  return (
    <>
      {editing ? null : (
        <>
          <CheckBanner />
          <AutoCard />
          <LakeButtons />
        </>
      )}
      <PageTitle
        atTop={false}
        helps={
          prefilled
            ? [
                'Valeurs reprises de la dernière entrée : ne changez que ce qui a bougé.',
              ]
            : []
        }
      >
        {editing ? 'Modifier l’entrée' : 'Nouvelle entrée'}
      </PageTitle>
      <div id="fields" key={generation}>
        {fields.map((field) => (
          <EntryField
            key={field.key}
            field={field}
            hidden={
              lake !== null &&
              SAIL_KEYS.includes(field.key) &&
              sailHidden(field.key, lake)
            }
          />
        ))}
      </div>
      <div className={editing ? 'save-bar row c2' : 'save-bar row'}>
        {editing ? (
          <Button
            className="btn big"
            id="cancelBtn"
            onClick={() => {
              setDraft(null);
              go('log');
            }}
          >
            Annuler
          </Button>
        ) : null}
        <Button
          className="btn big primary"
          id="saveBtn"
          onClick={() => {
            buzz();
            saveDraftAsEntry();
          }}
        >
          ✔ Enregistrer
        </Button>
      </div>
      {editing ? null : (
        <div className="row" style={{ marginTop: '16px' }}>
          <ArmedButton
            className="btn"
            id="resetBtn"
            armedLabel="Toucher encore pour confirmer"
            onConfirm={() => {
              setDraft({ t: new Date().toISOString(), v: {} });
              setGeneration((value) => value + 1);
            }}
          >
            Tout effacer et recommencer
          </ArmedButton>
        </div>
      )}
    </>
  );
}
