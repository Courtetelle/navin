import { Button } from '../../components/shared/Button.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { CallButton, ContactButtons } from '../../features/safety/Contacts.tsx';
import type { CallItem } from '../../features/safety/contacts.ts';
import { contactItems } from '../../features/safety/contacts.ts';
import { spell, spellDigits } from '../../features/safety/nato.ts';
import { openView } from '../../features/safety/openView.ts';
import type { SosKind } from '../../features/safety/sosScripts.ts';
import { SOS, SOS_KINDS, VOCAB } from '../../features/safety/sosScripts.ts';
import { radioDesc } from '../../lib/boatDescription.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import type { CruiseInfo } from '../../model/types.ts';

/**
 * The buttons of the radio messages.
 * @param props - Opens a message.
 * @returns The grid.
 */
export function SosGrid({ onScript }: { onScript: (kind: SosKind) => void }) {
  return (
    <div className="sos-grid">
      {SOS_KINDS.map((kind) => (
        <Button
          key={kind}
          className={`btn sos ${SOS[kind].cls}`}
          data-sos={kind}
          onClick={() => {
            buzz();
            onScript(kind);
          }}
        >
          {SOS[kind].title}
          <small>{SOS[kind].sub}</small>
        </Button>
      ))}
    </div>
  );
}

/**
 * A big button that opens the man overboard screen.
 * @param props - Zone given to the screen.
 * @returns The button.
 */
export function MobButton({ zone }: { zone: 'lac' | 'mer' }) {
  return (
    <Button
      className="btn big mob-open"
      data-go="mob"
      data-arg={zone}
      onClick={() => openView('mob', zone)}
    >
      🛟 Homme à la mer
    </Button>
  );
}

/**
 * The big button of the phonetic alphabet.
 * @returns The button.
 */
export function AlphaButton() {
  return (
    <Button
      className="btn big"
      data-go="alpha"
      onClick={() => openView('alpha')}
    >
      🔤 Alphabet phonétique
      <small>Alfa, Bravo, Charlie… et épeler un mot</small>
    </Button>
  );
}

/**
 * « Identité radio ».
 * @param props - Boat information and whether to offer to complete it.
 * @returns The section.
 */
export function RadioIdentity({
  info,
  offerInfo,
}: {
  info: Readonly<CruiseInfo>;
  offerInfo: boolean;
}) {
  return (
    <FoldSection title="Identité radio">
      <div className="ident">
        <div>
          <b>{textOf(info.boat) || '–'}</b>
        </div>
        <div>
          Indicatif : <b>{textOf(info.callsign) || '–'}</b>
          <br />
          <small>{spell(info.callsign)}</small>
        </div>
        <div>
          MMSI : <b>{textOf(info.mmsi) || '–'}</b>
          <br />
          <small>{spellDigits(info.mmsi)}</small>
        </div>
        <div>{radioDesc(info, 'en')}</div>
      </div>
      {offerInfo && (!info.boat || !info.mmsi) ? (
        <Button className="btn" data-go="info" onClick={() => openView('info')}>
          Compléter dans Bateau et croisière
        </Button>
      ) : null}
    </FoldSection>
  );
}

/**
 * « Canaux bateau à bateau ».
 * @returns The section.
 */
export function ChannelsSection() {
  return (
    <FoldSection title="Canaux bateau à bateau">
      <div className="value" style={{ fontSize: 34 }}>
        6 · 8 · 72 · 77
      </div>
    </FoldSection>
  );
}

/**
 * « Vocabulaire radio ».
 * @returns The folded details.
 */
export function Vocabulary() {
  return (
    <details className="section">
      <summary>Vocabulaire radio</summary>
      <dl className="vocab">
        {VOCAB.map(([english, french]) => [
          <dt key={`${english}-dt`}>{english}</dt>,
          <dd key={`${english}-dd`}>{french}</dd>,
        ])}
      </dl>
    </details>
  );
}

/**
 * A titled section of contacts.
 * @param props - Title and contacts text.
 * @returns The section.
 */
export function ContactsSection({
  title,
  text,
}: {
  title: string;
  text: string | undefined;
}) {
  return (
    <FoldSection title={title}>
      <div className="contacts">
        <ContactButtons items={contactItems(text)} />
      </div>
    </FoldSection>
  );
}

/**
 * « Équipage et proches ».
 * @param props - Calls of the crew.
 * @returns The section, or nothing without any number.
 */
export function CrewCalls({ calls }: { calls: readonly CallItem[] }) {
  if (calls.length === 0) return null;
  return (
    <FoldSection title="Équipage et proches">
      <div className="contacts">
        {keyedItems(calls, (call) => call.number).map(({ key, item }) => (
          <CallButton key={key} {...item} />
        ))}
      </div>
    </FoldSection>
  );
}
