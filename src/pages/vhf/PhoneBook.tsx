import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { SwipeRow } from '../../features/prep/index.ts';
import { CallButton } from '../../features/safety/Contacts.tsx';
import type { PhoneEntry } from '../../features/safety/phoneBook.ts';
import {
  PHONE_KINDS,
  addPhone,
  currentPhoneBook,
  deletePhone,
  searchPhones,
} from '../../features/safety/phoneBook.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';

/**
 * The phone page: the useful numbers (harbours, contacts, the crew cards, the
 * numbers of the boat), sorted by name, with a search over every entry. The
 * emergency numbers and the position are in SOS.
 * @returns The screen content.
 */
export function PhoneBook() {
  useSignals();
  const tr = useTr();
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  // Read so that the list follows the crew cards and the boat.
  const all = state.data.members.value ? currentPhoneBook() : [];
  const shown = searchPhones(all, query);
  return (
    <>
      <PageBack
        label="◀ Carte"
        data-go="tracker"
        onClick={() => {
          buzz();
          go('tracker');
        }}
      />
      <h1>{tr('📞 Téléphones utiles')}</h1>
      <div className="field">
        <input
          className="text"
          id="phoneSearch"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={tr.placeholder('Rechercher un nom, un numéro, un port…')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="contacts phone-book" key={version}>
        {shown.map((entry) => (
          <PhoneRow
            key={entry.id}
            entry={entry}
            onDeleted={() => setVersion((value) => value + 1)}
          />
        ))}
      </div>
      {shown.length === 0 ? (
        <HelpText>
          {all.length === 0
            ? 'Aucun numéro pour l’instant : ajoutez les ports et vos contacts ci-dessous ; les téléphones des fiches équipiers viennent d’eux-mêmes.'
            : 'Aucun numéro ne correspond à la recherche.'}
        </HelpText>
      ) : null}
      <AddPhone onAdded={() => setVersion((value) => value + 1)} />
    </>
  );
}

function PhoneRow({
  entry,
  onDeleted,
}: {
  entry: PhoneEntry;
  onDeleted: () => void;
}) {
  const button = (
    <CallButton
      label={entry.name}
      number={entry.number}
      sub={PHONE_KINDS[entry.kind]}
    />
  );
  if (!entry.own) return button;
  return (
    <SwipeRow
      id={entry.id}
      name={entry.name}
      onDelete={(id) => {
        deletePhone(id);
        onDeleted();
      }}
    >
      {button}
    </SwipeRow>
  );
}

function AddPhone({ onAdded }: { onAdded: () => void }) {
  const tr = useTr();
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [kind, setKind] = useState<'port' | 'contact'>('port');
  return (
    <FoldSection title="＋ Ajouter un numéro">
      <label className="cf wide">
        <span>{tr('Nom')}</span>
        <input
          className="text"
          id="phoneName"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="cf wide">
        <span>{tr('Numéro')}</span>
        <input
          className="text"
          id="phoneNumber"
          type="tel"
          inputMode="tel"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
      </label>
      <label className="cf wide">
        <span>{tr('Type')}</span>
        <select
          className="text"
          id="phoneKind"
          value={kind}
          onChange={(event) =>
            setKind(event.target.value === 'contact' ? 'contact' : 'port')
          }
        >
          <option value="port">{tr('Port')}</option>
          <option value="contact">{tr('Contact')}</option>
        </select>
      </label>
      <ButtonRow>
        <Button
          className="btn big primary"
          id="phoneAdd"
          disabled={!name.trim() || !/\d/u.test(number)}
          onClick={() => {
            buzz();
            addPhone(name, number, kind);
            toast(`📞 ${name.trim()} ajouté`);
            setName('');
            setNumber('');
            onAdded();
          }}
        >
          {tr('Enregistrer le numéro')}
        </Button>
      </ButtonRow>
    </FoldSection>
  );
}
