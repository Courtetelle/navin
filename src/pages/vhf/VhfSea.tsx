import { untracked } from '@preact/signals-react';

import { Button } from '../../components/shared/Button.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { openView } from '../../features/safety/openView.ts';
import { VHF_CALLS, VHF_CALL_KEYS } from '../../features/safety/vhfCalls.ts';
import { VHF_CHANNELS, vhfDialog } from '../../features/safety/vhfDialog.ts';
import type { VhfCallKey } from '../../features/safety/vhfTypes.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { state } from '../../state/index.ts';

const OTHER_BOAT = 'ALBATROS';

/** Props of {@link VhfSea}. */
export interface VhfSeaProps {
  onCall: (call: VhfCallKey) => void;
}

/**
 * Routine calls at sea (legacy `VIEWS.vhf`): the catalogue, the procedure, an
 * example of a dialogue and the channels.
 * @param props - Opens a call.
 * @returns The screen content.
 */
export function VhfSea({ onCall }: VhfSeaProps) {
  const me = untracked(() =>
    (textOf(state.data.cruise.value?.info.boat) || 'Inspiration').toUpperCase(),
  );
  return (
    <>
      <PageBack
        label="◀ Sécurité"
        data-go="sos"
        onClick={() => openView('sos')}
      />
      <PageTitle
        helps={[
          'Messages pré-remplis avec le bateau, l’indicatif, le MMSI, les dimensions, la position et l’équipage. Choisissez un appel.',
        ]}
      >
        VHF : appels de routine
      </PageTitle>
      <div className="vhf-grid">
        {VHF_CALL_KEYS.map((key) => (
          <Button
            key={key}
            className="btn vhf-call"
            data-vhf={key}
            onClick={() => {
              buzz();
              onCall(key);
            }}
          >
            <b>{VHF_CALLS[key].title}</b>
            <small>{VHF_CALLS[key].sub}</small>
          </Button>
        ))}
      </div>
      <Button
        className="btn big"
        data-go="alpha"
        onClick={() => openView('alpha')}
      >
        🔤 Alphabet phonétique
        <small>Alfa, Bravo, Charlie… et épeler un mot</small>
      </Button>
      <FoldSection title="Procédure">
        <ol className="asn">
          <li>Écouter avant de parler : le canal doit être libre.</li>
          <li>
            Appel : nom de la station 2 ou 3 fois, puis « This is » et votre nom
            3 fois.
          </li>
          <li>
            Sur le 16, appeler seulement puis dégager vers un canal de travail.
          </li>
          <li>
            Phrases courtes, finir chaque tour par OVER et la fin par OUT.
          </li>
        </ol>
      </FoldSection>
      <FoldSection title="Exemple : du canal 16 vers un canal de travail">
        <HelpText>
          {`${me} appelle le voilier ${OTHER_BOAT} ancré non loin. Le 16 sert seulement à se trouver : on dégage tout de suite.`}
        </HelpText>
        <div className="vhf-dlg">
          {keyedItems(vhfDialog(me, OTHER_BOAT), (turn) => turn[2]).map(
            ({ key, item: [who, channel, english, french] }) =>
              who === '—' ? (
                <p key={key} className="vhf-sw">
                  {english}
                </p>
              ) : (
                <div key={key} className={`vhf-say ${who === 'A' ? 'a' : 'b'}`}>
                  <span className="vhf-who">
                    {who === 'A' ? me : OTHER_BOAT} · canal {channel}
                  </span>
                  <b>{english}</b>
                  <small>{french}</small>
                </div>
              ),
          )}
        </div>
        <HelpText>
          Si le canal proposé est occupé, l’autre répond « Channel 72 busy,
          propose 77 » (72 occupé, je propose 77). Si personne ne répond après 3
          appels, attendre 2 minutes avant de rappeler. Après la conversation,
          revenir en veille sur le 16.
        </HelpText>
      </FoldSection>
      <FoldSection title="Canaux entre bateaux proches">
        <div className="value" style={{ fontSize: 34 }}>
          72 · 77 · 06 · 08
        </div>
        <table className="vhf-ch">
          <tbody>
            {VHF_CHANNELS.map(([channel, use]) => (
              <tr key={channel}>
                <th>{channel}</th>
                <td>{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <HelpText>
          Pour un bateau proche, passer en petite puissance (bouton 1 W / LO).
          Règles et canaux peuvent varier selon le pays : suivre les indications
          locales.
        </HelpText>
      </FoldSection>
    </>
  );
}
