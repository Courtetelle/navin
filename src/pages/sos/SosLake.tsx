import { untracked } from '@preact/signals-react';

import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { EmergencyCalls } from '../../features/safety/EmergencyCalls.tsx';
import { lakeMessage } from '../../features/safety/vhfContext.ts';
import { radioDesc } from '../../lib/boatDescription.ts';
import {
  lastKnownPos,
  sosLogActive,
  sosLogAdd,
  state,
} from '../../state/index.ts';

/**
 * On a lake, the rescue is called by phone: the numbers to call, in order,
 * then the message to dictate.
 * @param props - The boat is on the French side of Lake Geneva.
 * @returns The two sections.
 */
export function SosLake({ french }: { french: boolean }) {
  const message = untracked(() => {
    const cruise = state.data.cruise.value;
    const info = cruise?.info ?? {};
    return lakeMessage({
      boat: info.boat,
      registration: info.reg,
      position: lastKnownPos(),
      french,
      onBoard: cruise?.crew.length ?? 0,
      description: radioDesc(info, 'fr'),
    });
  });
  return (
    <>
      <FoldSection title="Appeler les secours">
        <EmergencyCalls
          french={french}
          dataKey="data-vcall"
          onCall={(label, number) => {
            if (sosLogActive()) {
              sosLogAdd(`SOS lac › Appel ${label} (${number})`);
            }
          }}
        />
        <HelpText>
          Sur le lac, les secours se joignent par téléphone. Si le premier appel
          n’aboutit pas, essayer le suivant. Les numéros courts suisses ne
          passent que sur un réseau suisse ; le 112 passe partout.
        </HelpText>
      </FoldSection>
      <FoldSection title="Message à dicter">
        <div className="script">
          {message.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <HelpText>
          Parler lentement, donner la position en premier si la liaison est
          mauvaise, épeler le nom du bateau avec l’alphabet.
        </HelpText>
      </FoldSection>
    </>
  );
}
