import { untracked } from '@preact/signals-react';

import { Button } from '../../components/shared/Button.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { EmergencyCalls } from '../../features/safety/EmergencyCalls.tsx';
import { GpsButton } from '../../features/safety/GpsButton.tsx';
import { openView } from '../../features/safety/openView.ts';
import { useLocalTimes } from '../../features/safety/useLocalTimes.ts';
import { lakeMessage } from '../../features/safety/vhfContext.ts';
import { radioDesc } from '../../lib/boatDescription.ts';
import { inFrenchLeman } from '../../model/contacts.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import {
  lastKnownPos,
  sosLogActive,
  sosLogAdd,
  state,
} from '../../state/index.ts';
import { PositionLines, PositionTime } from '../sos/SosPosition.tsx';

/** Props of {@link VhfLake}. */
export interface VhfLakeProps {
  /** Redraws the screen. */
  onRedraw: () => void;
}

/**
 * Inland section (legacy `renderVhfLake`): on a lake the rescue services are
 * reached by phone; the screen gives the numbers, the position and the message.
 * @param props - Redraw.
 * @returns The screen content.
 */
export function VhfLake({ onRedraw }: VhfLakeProps) {
  useLocalTimes(true);
  const { position, french, message } = untracked(readScreen);
  return (
    <>
      <PageBack
        label="◀ Sécurité"
        data-go="sos"
        onClick={() => openView('sos')}
      />
      <h1>VHF · navigation intérieure</h1>
      <FoldSection title="Appeler les secours">
        <EmergencyCalls
          french={french}
          dataKey="data-vcall"
          onCall={(label, number) => {
            if (sosLogActive()) {
              sosLogAdd(`VHF lac › Appel ${label} (${number})`);
            }
          }}
        />
        <HelpText>
          Sur le lac, les secours se joignent par téléphone. Si le premier appel
          n’aboutit pas, essayer le suivant. Les numéros courts suisses ne
          passent que sur un réseau suisse ; le 112 passe partout.
        </HelpText>
      </FoldSection>
      <FoldSection title="Position à donner">
        <div className="value" style={{ fontSize: 26 }}>
          <PositionLines position={position} />
        </div>
        <PositionTime position={position} />
        <GpsButton
          className="btn big primary"
          id="vhfGps"
          onPosition={(fix) => {
            state.view.sosPos.value = {
              lat: fix.coords.latitude,
              lon: fix.coords.longitude,
              at: new Date().toISOString(),
            };
            onRedraw();
          }}
        >
          📍 Actualiser la position GPS
        </GpsButton>
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
      <Button
        className="btn big"
        data-go="alpha"
        onClick={() => openView('alpha')}
      >
        🔤 Alphabet phonétique
        <small>Alfa, Bravo, Charlie… et épeler un mot</small>
      </Button>
      <FoldSection title="Règles VHF sur les lacs">
        <HelpText>
          À compléter : les règles et canaux VHF propres aux lacs suisses seront
          ajoutés ici.
        </HelpText>
      </FoldSection>
    </>
  );
}

function readScreen() {
  const cruise = state.data.cruise.value;
  const info = cruise?.info ?? {};
  const position = lastKnownPos();
  const french = inFrenchLeman(position);
  return {
    position,
    french,
    message: lakeMessage({
      boat: info.boat,
      registration: info.reg,
      position,
      french,
      onBoard: cruise?.crew.length ?? 0,
      description: radioDesc(info, 'fr'),
    }),
  };
}
