import { untracked } from '@preact/signals-react';

import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { ContactButtons } from '../../features/safety/Contacts.tsx';
import { SosEndButton } from '../../features/safety/SosEndButton.tsx';
import { SosLogBanner } from '../../features/safety/SosLogBanner.tsx';
import { SosPosBlock } from '../../features/safety/SosPosBlock.tsx';
import { contactItems, crewCalls } from '../../features/safety/contacts.ts';
import { sosSimulation } from '../../features/safety/sosExercise.ts';
import type { SosKind } from '../../features/safety/sosScripts.ts';
import { useLocalTimes } from '../../features/safety/useLocalTimes.ts';
import { textOf } from '../../lib/format.ts';
import {
  DEFAULT_CONTACTS,
  LAKE_CONTACTS,
  LEMAN_FR_CONTACTS,
  inFrenchLeman,
} from '../../model/contacts.ts';
import type { CruiseInfo } from '../../model/types.ts';
import {
  lastKnownPos,
  navZone,
  sosLogActive,
  state,
} from '../../state/index.ts';

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

/** Props of {@link SosMain}. */
export interface SosMainProps {
  onScript: (kind: SosKind) => void;
  /** Redraws the screen. */
  onRedraw: () => void;
}

/**
 * The SOS tools of the zone, read when the screen is drawn: on a lake no radio
 * message, identity nor channel, only phones (legacy `VIEWS.sos`).
 * @param props - Screen actions.
 * @returns The screen content.
 */
export function SosMain({ onScript, onRedraw }: SosMainProps) {
  const { info, position, lake, french, positionShown, crew } =
    untracked(readScreen);
  useLocalTimes(lake);
  const contactsText = french
    ? withoutEuropeanNumber(textOf(info.contacts))
    : textOf(info.contacts);
  const contacts = contactItems(contactsText);
  return (
    <>
      <h1>Sécurité et secours</h1>
      <SosLogBanner />
      <SosPosBlock />
      {lake ? null : <SosGrid onScript={onScript} />}
      <MobButton zone={lake ? 'lac' : 'mer'} />
      {positionShown ? (
        <PositionSection position={position} onRedraw={onRedraw} />
      ) : null}
      {lake ? null : <RadioIdentity info={info} offerInfo />}
      {french ? (
        <FoldSection title="Urgences France (vous êtes côté français)">
          <div className="contacts">
            <ContactButtons items={contactItems(LEMAN_FR_CONTACTS)} />
          </div>
          <HelpText>
            Le 112 marche sur tous les réseaux. Les numéros courts suisses ne
            passent que si le téléphone est sur un réseau suisse.
          </HelpText>
        </FoldSection>
      ) : null}
      <FoldSection title={french ? 'Numéros utiles Suisse' : 'Numéros utiles'}>
        <div className="contacts">
          {contacts.length > 0 ? (
            <ContactButtons items={contacts} />
          ) : (
            <HelpText>Ajoutez-les dans Bateau et croisière.</HelpText>
          )}
        </div>
      </FoldSection>
      {info.base ? (
        <ContactsSection title="Loueur, base" text={textOf(info.base)} />
      ) : null}
      <CrewCalls calls={crewCalls(crew)} />
      {info.meteo ? (
        <FoldSection title="Météo">
          <p className="pre">{textOf(info.meteo)}</p>
        </FoldSection>
      ) : null}
      {lake ? null : <ChannelsSection />}
      <AlphaButton />
      {lake ? null : <Vocabulary />}
      <HelpText>
        {`${lake ? '🏞 Outils du lac' : '🌊 Outils de la mer'} (selon votre position). Appui long sur « SOS » : tous les outils, lac et mer.`}
      </HelpText>
      <SosEndButton onEnded={onRedraw} />
    </>
  );
}

function readScreen() {
  const cruise = state.data.cruise.value;
  const lake = navZone() === 'lac';
  const fallback = lake ? LAKE_CONTACTS : DEFAULT_CONTACTS;
  const info: Readonly<CruiseInfo> = cruise
    ? cruise.info
    : { contacts: fallback };
  const position = lastKnownPos();
  return {
    info,
    position,
    lake,
    french: lake && inFrenchLeman(position),
    positionShown: !sosLogActive() && !sosSimulation(),
    crew: cruise ? cruise.crew : [],
  };
}

function withoutEuropeanNumber(contacts: string): string {
  return contacts
    .split('\n')
    .filter((line) => !/^\s*urgence \(europe\)/i.test(line))
    .join('\n');
}
