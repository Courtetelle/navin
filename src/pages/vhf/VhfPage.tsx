import { untracked } from '@preact/signals-react';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useRedraw } from '../../features/safety/useRedraw.ts';
import type { VhfCallKey } from '../../features/safety/vhfTypes.ts';
import { buzz } from '../../lib/dom.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import { navZone, state } from '../../state/index.ts';

import { PhoneBook } from './PhoneBook.tsx';
import { VhfCallScreen } from './VhfCallScreen.tsx';
import { VhfSea } from './VhfSea.tsx';

/**
 * Screen `vhf` (legacy `VIEWS.vhf`): the zone decides between the inland page
 * (phones) and the routine calls at sea.
 * @param props - Page props: `int` or `ext` force a zone.
 * @returns The screen content.
 */
export function VhfPage({ arg }: PageProps) {
  const [call, setCall] = useState<VhfCallKey | null>(null);
  const { version } = useRedraw();
  const hasCruise = untracked(() => state.data.cruise.value !== null);
  const zone =
    arg === 'int' || arg === 'ext'
      ? arg
      : untracked(navZone) === 'lac'
        ? 'int'
        : 'ext';
  // The phone: the useful numbers (rescue, position and message are in SOS).
  if (zone === 'int') return <PhoneBook key={version} />;
  if (!hasCruise) return <VhfWithoutCruise />;
  if (call) return <VhfCallScreen call={call} onBack={() => setCall(null)} />;
  return <VhfSea onCall={setCall} />;
}

function VhfWithoutCruise() {
  return (
    <>
      <PageTitle
        helps={[
          {
            text: 'Les appels de routine en mer reprennent le bateau, l’indicatif et le MMSI de la navigation : ouvrez ou créez d’abord une navigation en mer.',
            nextIsRow: true,
          },
        ]}
      >
        VHF
      </PageTitle>
      <ButtonRow>
        <Button
          className="btn big primary"
          data-go="cruises"
          onClick={() => {
            buzz();
            go('cruises');
          }}
        >
          ⛵ Mes navigations
        </Button>
      </ButtonRow>
    </>
  );
}
