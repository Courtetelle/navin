import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { DocImport, DocList } from '../../features/voyages/VoyageDocs.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import { shareSections } from '../../features/voyages/voyageShare.ts';
import { voyageBack } from '../../features/voyages/voyageWords.ts';
import { whatsappHref } from '../../features/voyages/whatsapp.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import type { VoyageCard, VoyagePerson } from '../../model/voyages.ts';
import {
  CARD_FIELDS,
  CONTRACT_KINDS,
  PERSON_FIELDS,
  contractCard,
  contractFilled,
  contractKindsOf,
  contractSections,
  emptyPerson,
} from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import {
  state,
  syncVoyageNavigations,
  updateVoyages,
} from '../../state/index.ts';

type LinkKind = 'text' | 'tel' | 'mail' | 'web' | 'area';

/**
 * A value read: a phone number calls, a mail writes, a site opens.
 * @param props - The value and its kind.
 * @param props.value - The value.
 * @param props.kind - What it is.
 * @returns The text or the link.
 */
function Value({ value, kind }: { value: string; kind: LinkKind }) {
  if (kind === 'tel') {
    const whatsapp = whatsappHref(value);
    return (
      <>
        <a
          className="voy-link"
          href={`tel:${value.replaceAll(/[^\d+]/gu, '')}`}
        >
          📞 {value}
        </a>
        {whatsapp ? (
          <a
            className="voy-link voy-wa"
            href={whatsapp}
            target="_blank"
            rel="noopener"
            data-voywa={value}
          >
            💬 WhatsApp
          </a>
        ) : null}
      </>
    );
  }
  if (kind === 'mail') {
    return (
      <a className="voy-link" href={`mailto:${value}`}>
        ✉️ {value}
      </a>
    );
  }
  if (kind === 'web') {
    const href = /^https?:\/\//iu.test(value) ? value : `https://${value}`;
    return (
      <a className="voy-link" href={href} target="_blank" rel="noopener">
        🌐 {value}
      </a>
    );
  }
  return <span className="voy-text">{value}</span>;
}

function patchCard(
  catId: string,
  cardId: string,
  recipe: (card: VoyageCard) => void,
): void {
  updateVoyages((voyages) => {
    const card = voyages.categories
      .find((cat) => cat.id === catId)
      ?.cards.find((item) => item.id === cardId);
    if (card) recipe(card);
  });
}

/**
 * A contract read: its filled lines, then its contacts.
 * @param props - The contract.
 * @param props.card - The contract.
 * @returns The lines.
 */
function CardReading({ card }: { card: VoyageCard }) {
  const tr = useTr();
  const lines = CARD_FIELDS.filter(([key]) => card[key].trim());
  const persons = card.persons.filter((person) =>
    [person.nom, person.role, person.tel, person.mail].some((part) =>
      part.trim(),
    ),
  );
  if (lines.length === 0 && persons.length === 0) {
    return <HelpText>À compléter : touchez le crayon en haut.</HelpText>;
  }
  return (
    <dl className="voy-lines">
      {lines.map(([key, label, kind]) => (
        <div key={key} className={`voy-line voy-${key}`}>
          <dt>{tr(label)}</dt>
          <dd>
            <Value value={card[key].trim()} kind={kind} />
          </dd>
        </div>
      ))}
      {persons.map((person) => (
        <div key={person.id} className="voy-line voy-person">
          <dt>{person.role.trim() || tr('Contact')}</dt>
          <dd>
            <b>{person.nom}</b>
            {person.tel.trim() ? (
              <Value value={person.tel.trim()} kind="tel" />
            ) : null}
            {person.mail.trim() ? (
              <Value value={person.mail.trim()} kind="mail" />
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One person of a contract, changed in place.
 * @param props - Where the person is.
 * @param props.catId - Category id.
 * @param props.cardId - Contract id.
 * @param props.person - The person.
 * @returns The fields.
 */
function PersonEdit({
  catId,
  cardId,
  person,
}: {
  catId: string;
  cardId: string;
  person: VoyagePerson;
}) {
  const tr = useTr();
  const patch = (key: (typeof PERSON_FIELDS)[number][0], value: string) =>
    patchCard(catId, cardId, (card) => {
      const found = card.persons.find((item) => item.id === person.id);
      if (found) found[key] = value;
    });
  return (
    <div className="voy-person-edit" data-voyperson={person.id}>
      <div className="cgrid">
        {PERSON_FIELDS.map(([key, label, kind]) => (
          <div key={key} className="cf">
            <label htmlFor={`vp-${person.id}-${key}`}>{tr(label)}</label>
            <input
              id={`vp-${person.id}-${key}`}
              className="text"
              value={person[key]}
              type={kind === 'tel' ? 'tel' : kind === 'mail' ? 'email' : 'text'}
              autoComplete="off"
              onChange={(event) => patch(key, event.target.value)}
            />
          </div>
        ))}
      </div>
      <ButtonRow>
        <HoldDeleteButton
          className="btn danger"
          data-voypersondel={person.id}
          onClick={buzz}
          onDelete={() =>
            patchCard(catId, cardId, (card) => {
              card.persons = card.persons.filter(
                (item) => item.id !== person.id,
              );
            })
          }
        >
          {tr(`🗑 Retirer ${person.nom.trim() || 'ce contact'}`)}
        </HoldDeleteButton>
      </ButtonRow>
    </div>
  );
}

/**
 * A contract changed in place, saved at each letter.
 * @param props - Where the contract is and how to close.
 * @param props.catId - Category id.
 * @param props.card - The contract.
 * @param props.onDone - Back to reading.
 * @returns The form.
 */
function CardEdit({ catId, card }: { catId: string; card: VoyageCard }) {
  const tr = useTr();
  return (
    <div className="voy-card-edit">
      <div className="cgrid">
        {CARD_FIELDS.map(([key, label, kind]) => (
          <div
            key={key}
            className={`cf ${kind === 'area' || key === 'adresse' ? 'wide' : ''}`}
          >
            <label htmlFor={`vc-${card.id}-${key}`}>{tr(label)}</label>
            {kind === 'area' ? (
              <textarea
                id={`vc-${card.id}-${key}`}
                className="text"
                rows={3}
                value={card[key]}
                onChange={(event) =>
                  patchCard(catId, card.id, (draft) => {
                    draft[key] = event.target.value;
                  })
                }
              />
            ) : (
              <input
                id={`vc-${card.id}-${key}`}
                className="text"
                value={card[key]}
                type={
                  kind === 'tel'
                    ? 'tel'
                    : kind === 'mail'
                      ? 'email'
                      : kind === 'web'
                        ? 'url'
                        : 'text'
                }
                autoComplete="off"
                onChange={(event) =>
                  patchCard(catId, card.id, (draft) => {
                    draft[key] = event.target.value;
                  })
                }
              />
            )}
          </div>
        ))}
      </div>
      <h3 className="sub-h">{tr('Contacts')}</h3>
      {card.persons.map((person) => (
        <PersonEdit
          key={person.id}
          catId={catId}
          cardId={card.id}
          person={person}
        />
      ))}
      <HelpText>Enregistrement automatique.</HelpText>
      <ButtonRow>
        <Button
          className="btn big act-add"
          data-voypersonadd={card.id}
          onClick={() => {
            buzz();
            patchCard(catId, card.id, (draft) => {
              draft.persons.push(emptyPerson(uid()));
            });
          }}
        >
          {tr('＋ Contact')}
        </Button>
      </ButtonRow>
    </div>
  );
}

/**
 * One contract (sub-screen of `vcontracts`): its sheet read, or its fields
 * with the pencil; its documents; its sharing.
 * @param props - The contract.
 * @param props.kind - Its kind in {@link CONTRACT_KINDS}.
 * @returns The screen content.
 */
function ContractScreen({ kind }: { kind: (typeof CONTRACT_KINDS)[number] }) {
  useSignals();
  const tr = useTr();
  const voyages = state.data.voyages.value;
  const { id, categories } = voyages;
  const card = contractCard(voyages, kind.id);
  // A contract still empty opens on its fields, for the first entry.
  const { editing, validate } = useChapterEdit(
    () => syncVoyageNavigations(id),
    !card || !contractFilled(card),
  );
  const category = categories.find((cat) => cat.id === kind.id);
  return (
    <>
      <PageBack
        label={voyageBack()}
        data-go="voyage"
        onClick={() => {
          buzz();
          go('voyage');
        }}
      >
        {tr(voyageBack())}
      </PageBack>
      {validate}
      <PageTitle
        titleText={kind.name}
        helps={[
          'Le crayon en haut ouvre les champs : société, n° de contrat, adresse, téléphones, courriel, site, notes et contacts ; ✔ pour finir. Un numéro touché appelle, un courriel touché écrit.',
        ]}
      >
        {`${kind.icon} ${kind.name}`}
      </PageTitle>
      {card ? (
        <div className="voy-card" data-voycard={card.id}>
          {editing ? (
            <CardEdit catId={kind.id} card={card} />
          ) : (
            <CardReading card={card} />
          )}
        </div>
      ) : null}
      <FoldSection title="📎 Documents" titleText={`voy-docs-${kind.id}`}>
        <div className="voy-cat-body">
          <DocList cat={kind.id} editing={editing} />
          {editing ? <DocImport cat={kind.id} /> : null}
        </div>
      </FoldSection>
      <ShareButton
        data-voyshare={kind.id}
        onShare={(format) =>
          void shareSections(
            `Croisière · ${kind.name}`,
            contractSections(category ? [category] : []),
            format,
          )
        }
      />
    </>
  );
}

/**
 * Screen `vcontracts` (data › Croisières › Contrats): four buttons, Courtier,
 * Compagnie de location, Assurance annulation, Protection de caution; each
 * opens its sheet (`go('vcontracts', kind)`), filled with the pencil.
 * @param props - Page props; `arg` is the contract opened.
 * @returns The screen content.
 */
export function ContractsPage({ arg }: PageProps) {
  useSignals();
  const tr = useTr();
  const voyages = state.data.voyages.value;
  const { categories, id } = voyages;
  if (!id) return <NoVoyage />;
  const opened = CONTRACT_KINDS.find((kind) => kind.id === arg);
  if (opened) return <ContractScreen key={opened.id} kind={opened} />;
  const kinds = contractKindsOf(voyages);
  const shown = categories.filter((cat) =>
    kinds.some((kind) => kind.id === cat.id),
  );
  return (
    <>
      <PageBack
        label={voyageBack()}
        data-go="voyage"
        onClick={() => {
          buzz();
          go('voyage');
        }}
      >
        {tr(voyageBack())}
      </PageBack>
      <PageTitle
        helps={[
          'Un bouton par contrat de la croisière : touchez-le pour ouvrir sa fiche, puis le crayon en haut pour la remplir.',
        ]}
      >
        📑 Contrats
      </PageTitle>
      <div className="row more-grid data-tiles" style={{ marginBottom: 12 }}>
        {kinds.map((kind) => {
          const card = contractCard(voyages, kind.id);
          const filled = card ? contractFilled(card) : false;
          const summary = [card?.org.trim(), card?.ref.trim()]
            .filter(Boolean)
            .join(' · ');
          return (
            <Button
              key={kind.id}
              className="btn big"
              data-voycontract={kind.id}
              onClick={() => {
                buzz();
                go('vcontracts', kind.id);
              }}
            >
              {`${kind.icon} ${tr(kind.name)}`}
              <small>
                {filled ? summary || tr('renseigné') : tr('à compléter')}
              </small>
            </Button>
          );
        })}
      </div>
      <ShareButton
        data-voyshare="contracts"
        onShare={(format) =>
          void shareSections(
            'Croisière · contrats',
            contractSections(shown),
            format,
          )
        }
      />
    </>
  );
}
