import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect } from 'react';

import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { CompactForm } from '../../features/logbook/index.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { refreshVoyageName } from '../../shell/router.ts';
import {
  infoSections,
  pullBoatIntoCruise,
  state,
  syncBoatFromCruise,
  updateCruise,
} from '../../state/index.ts';

const HELP =
  'Enregistrement automatique. Ces données servent aux calculs et aux messages SOS.';

/**
 * Screen `info` (legacy `VIEWS.info`): the boat and cruise sheet, the boat's
 * own sheet taking precedence, saved at each change.
 * @returns The screen.
 */
export function InfoPage() {
  useSignals();
  useNavFields();
  useLayoutEffect(() => {
    pullBoatIntoCruise();
  }, []);
  const cruise = state.data.cruise.value;
  return (
    <>
      <PageTitle helps={[HELP]}>Bateau et croisière</PageTitle>
      <div id="infoForm">
        {cruise ? (
          <CompactForm
            sections={infoSections()}
            data={cruise.info}
            onChange={(next, key) => {
              updateCruise((draft) => {
                draft.info = next;
              });
              syncBoatFromCruise(key);
              refreshVoyageName();
            }}
          />
        ) : null}
      </div>
    </>
  );
}
