import { untracked } from '@preact/signals-react';

import { Button } from '../../components/shared/Button.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { ContactButtons } from '../../features/safety/Contacts.tsx';
import { SosEndButton } from '../../features/safety/SosEndButton.tsx';
import { SosLogBanner } from '../../features/safety/SosLogBanner.tsx';
import { contactItems, crewCalls } from '../../features/safety/contacts.ts';
import { openView } from '../../features/safety/openView.ts';
import type { SosKind } from '../../features/safety/sosScripts.ts';
import { textOf } from '../../lib/format.ts';
import {
  DEFAULT_CONTACTS,
  LAKE_CONTACTS,
  LEMAN_FR_CONTACTS,
} from '../../model/contacts.ts';
import type { CruiseInfo } from '../../model/types.ts';
import { lastKnownPos, navZone, state } from '../../state/index.ts';

import { PositionSection } from './SosPosition.tsx';
import {
  AlphaButton,
  ChannelsSection,
  ContactsSection,
  CrewCalls,
  MobButton,
  RadioIdentity,
  SosGrid,
  Vocabulary,
} from './SosSections.tsx';

/** Props of {@link SosAll}. */
export interface SosAllProps {
  onScript: (kind: SosKind) => void;
  /** Redraws this screen. */
  onRedraw: () => void;
  /** Back to the zone tools once the procedure ended. */
  onEnded: () => void;
}

/**
 * All the tools, lake and sea (legacy `renderSosAll`, long press on SOS).
 * @param props - Screen actions.
 * @returns The screen content.
 */
export function SosAll({ onScript, onRedraw, onEnded }: SosAllProps) {
  const { info, position, crew } = untracked(readScreen);
  return (
    <>
      <h1>SOS · tous les outils</h1>
      <SosLogBanner />
      <PositionSection position={position} onRedraw={onRedraw} />
      <ContactsSection title="Numéros utiles" text={textOf(info.contacts)} />
      <CrewCalls calls={crewCalls(crew)} />
      <AlphaButton />
      <h2 className="set-group">🏞 Lac</h2>
      <MobButton zone="lac" />
      <ContactsSection title="Lac : numéros en Suisse" text={LAKE_CONTACTS} />
      <FoldSection title="Léman côté français">
        <div className="contacts">
          <ContactButtons items={contactItems(LEMAN_FR_CONTACTS)} />
        </div>
        <HelpText>
          Le 112 marche sur tous les réseaux. Les numéros courts suisses ne
          passent que si le téléphone est sur un réseau suisse.
        </HelpText>
      </FoldSection>
      <h2 className="set-group">🌊 Mer</h2>
      <MobButton zone="mer" />
      <SosGrid onScript={onScript} />
      <Button className="btn big" data-go="vhf" onClick={() => openView('vhf')}>
        📻 Appels VHF de routine
      </Button>
      <RadioIdentity info={info} offerInfo={false} />
      <ChannelsSection />
      <Vocabulary />
      <SosEndButton onEnded={onEnded} />
    </>
  );
}

function readScreen() {
  const cruise = state.data.cruise.value;
  const fallback = navZone() === 'lac' ? LAKE_CONTACTS : DEFAULT_CONTACTS;
  const info: Readonly<CruiseInfo> = cruise
    ? cruise.info
    : { contacts: fallback };
  return {
    info,
    position: lastKnownPos(),
    crew: cruise ? cruise.crew : [],
  };
}
