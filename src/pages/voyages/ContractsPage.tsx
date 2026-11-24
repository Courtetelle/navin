import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { DocImport, DocList } from '../../features/voyages/VoyageDocs.tsx';
import { shareSections } from '../../features/voyages/voyageShare.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import type {
  VoyageCard,
  VoyageCategory,
  VoyagePerson,
} from '../../model/voyages.ts';
import {
  CARD_FIELDS,
  PERSON_FIELDS,
  contractSections,
  emptyCard,
  emptyPerson,
} from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { state, toast, updateVoyages } from '../../state/index.ts';

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
    return (
      <a className="voy-link" href={`tel:${value.replaceAll(/[^\d+]/gu, '')}`}>
        📞 {value}
      </a>
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
    return <HelpText>À compléter : touchez ✏️ Modifier.</HelpText>;
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
function CardEdit({
  catId,
  card,
  onDone,
}: {
  catId: string;
  card: VoyageCard;
  onDone: () => void;
}) {
  const tr = useTr();
  return (
    <div className="voy-card-edit">
      <div className="cgrid">
        <div className="cf wide">
          <label htmlFor={`vc-${card.id}-title`}>
            {tr('Type (titre de la fiche)')}
          </label>
          <input
            id={`vc-${card.id}-title`}
            className="text"
            value={card.title}
            placeholder={tr.placeholder('ex. Assurance annulation')}
            autoComplete="off"
            onChange={(event) =>
              patchCard(catId, card.id, (draft) => {
                draft.title = event.target.value;
              })
            }
          />
        </div>
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
      <ButtonRow className="row c3">
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
        <HoldDeleteButton
          className="btn big danger"
          data-voycarddel={card.id}
          onClick={buzz}
          onDelete={() => {
            updateVoyages((voyages) => {
              const cat = voyages.categories.find((item) => item.id === catId);
              if (cat) {
                cat.cards = cat.cards.filter((item) => item.id !== card.id);
              }
            });
            onDone();
          }}
        >
          {tr('🗑 Supprimer la fiche')}
        </HoldDeleteButton>
        <Button
          className="btn big primary"
          data-voycarddone={card.id}
          onClick={() => {
            buzz();
            onDone();
          }}
        >
          {tr('✔ Terminé')}
        </Button>
      </ButtonRow>
    </div>
  );
}

/**
 * One contract: read, or changed after ✏️ Modifier.
 * @param props - Where it is.
 * @param props.catId - Category id.
 * @param props.card - The contract.
 * @param props.editing - It is being changed.
 * @param props.onEdit - Change it, or stop (null).
 * @returns The block.
 */
function CardBlock({
  catId,
  card,
  editing,
  onEdit,
}: {
  catId: string;
  card: VoyageCard;
  editing: boolean;
  onEdit: (id: string | null) => void;
}) {
  const tr = useTr();
  return (
    <div className="voy-card" data-voycard={card.id}>
      <h3 className="voy-card-title">
        {card.title.trim() || tr('Sans titre')}
      </h3>
      {editing ? (
        <CardEdit catId={catId} card={card} onDone={() => onEdit(null)} />
      ) : (
        <>
          <CardReading card={card} />
          <ButtonRow>
            <Button
              className="btn"
              data-voycardedit={card.id}
              onClick={() => {
                buzz();
                onEdit(card.id);
              }}
            >
              {tr('✏️ Modifier')}
            </Button>
          </ButtonRow>
        </>
      )}
    </div>
  );
}

/**
 * A category: its contracts, the new contract button, its documents, and
 * its own name and deletion.
 * @param props - The category.
 * @param props.cat - The category.
 * @param props.editing - Id of the contract being changed.
 * @param props.onEdit - Change a contract, or stop.
 * @returns The section.
 */
function CategorySection({
  cat,
  editing,
  onEdit,
}: {
  cat: VoyageCategory;
  editing: string | null;
  onEdit: (id: string | null) => void;
}) {
  const tr = useTr();
  const [renaming, setRenaming] = useState(false);
  return (
    <FoldSection
      data-voycat={cat.id}
      title={`${cat.name || 'Sans nom'} · ${cat.cards.length}`}
      titleText={cat.id}
    >
      {cat.cards.map((card) => (
        <CardBlock
          key={card.id}
          catId={cat.id}
          card={card}
          editing={editing === card.id}
          onEdit={onEdit}
        />
      ))}
      <ButtonRow>
        <Button
          className="btn big act-add"
          data-voycardadd={cat.id}
          onClick={() => {
            buzz();
            const id = uid();
            updateVoyages((voyages) => {
              voyages.categories
                .find((item) => item.id === cat.id)
                ?.cards.push(emptyCard(id, ''));
            });
            onEdit(id);
          }}
        >
          {tr(
            cat.id === 'assurances'
              ? '＋ Type d’assurance'
              : `＋ Fiche ${cat.name || ''}`.trim(),
          )}
        </Button>
      </ButtonRow>
      <h3 className="sub-h">{tr('📎 Documents')}</h3>
      <DocList cat={cat.id} />
      <DocImport cat={cat.id} />
      {renaming ? (
        <div className="cgrid voy-rename">
          <div className="cf wide">
            <label htmlFor={`vcat-${cat.id}`}>
              {tr('Nom de la catégorie')}
            </label>
            <input
              id={`vcat-${cat.id}`}
              className="text"
              value={cat.name}
              autoComplete="off"
              onChange={(event) =>
                updateVoyages((voyages) => {
                  const found = voyages.categories.find(
                    (item) => item.id === cat.id,
                  );
                  if (found) found.name = event.target.value;
                })
              }
            />
          </div>
        </div>
      ) : null}
      <ButtonRow className="row c2">
        <Button
          className="btn"
          data-voycatrename={cat.id}
          onClick={() => {
            buzz();
            setRenaming(!renaming);
          }}
        >
          {tr(renaming ? '✔ Terminé' : '✏️ Renommer la catégorie')}
        </Button>
        <HoldDeleteButton
          className="btn danger"
          data-voycatdel={cat.id}
          onClick={buzz}
          onDelete={() => {
            updateVoyages((voyages) => {
              voyages.categories = voyages.categories.filter(
                (item) => item.id !== cat.id,
              );
            });
            toast('Catégorie supprimée · ses documents vont dans Autres');
          }}
        >
          {tr('🗑 Supprimer la catégorie')}
        </HoldDeleteButton>
      </ButtonRow>
    </FoldSection>
  );
}

/**
 * Screen `vcontracts` (data › Croisières › Contrats): the agency, the renter
 * and the insurances, with addresses, phones, emergency numbers and
 * contacts; categories and contracts are added and deleted at will.
 * @returns The screen content.
 */
export function ContractsPage() {
  useSignals();
  const tr = useTr();
  const [editing, setEditing] = useState<string | null>(null);
  const { categories } = state.data.voyages.value;
  return (
    <>
      <PageBack
        label="◀ Croisières"
        data-go="voyages"
        onClick={() => {
          buzz();
          go('voyages');
        }}
      >
        {tr('◀ Croisières')}
      </PageBack>
      <PageTitle
        helps={[
          'Une catégorie par interlocuteur (agence, loueur, assurances…), une fiche par contrat : adresse, téléphone, urgence, contacts. Les catégories et les fiches s’ajoutent, se renomment et se suppriment (appui long). Un numéro touché appelle, un courriel touché écrit.',
        ]}
      >
        📑 Contrats
      </PageTitle>
      {categories.map((cat) => (
        <CategorySection
          key={cat.id}
          cat={cat}
          editing={editing}
          onEdit={setEditing}
        />
      ))}
      <ButtonRow>
        <Button
          className="btn big act-add"
          data-voycatadd
          onClick={() => {
            buzz();
            const id = uid();
            updateVoyages((voyages) => {
              voyages.categories.push({
                id,
                name: 'Nouvelle catégorie',
                cards: [emptyCard(uid(), '')],
              });
            });
            toast('Catégorie ajoutée : renommez-la en bas de sa section');
          }}
        >
          {tr('＋ Nouvelle catégorie')}
        </Button>
      </ButtonRow>
      <ShareButton
        data-voyshare="contracts"
        onShare={(format) =>
          void shareSections(
            'Croisière · contrats',
            contractSections(categories),
            format,
          )
        }
        choices={[
          {
            key: 'all',
            label: 'Tous les contrats',
            onShare: (format) =>
              void shareSections(
                'Croisière · contrats',
                contractSections(categories),
                format,
              ),
          },
          ...categories.map((cat) => ({
            key: cat.id,
            label: cat.name || 'Sans nom',
            onShare: (format: ShareFormat) =>
              void shareSections(
                `Croisière · ${cat.name || 'contrats'}`,
                contractSections([cat]),
                format,
              ),
          })),
        ]}
      />
    </>
  );
}
