/*
 * data › Croisières: what a charter needs besides the logbook. The crew of
 * the cruise, the contracts (agency, renter, insurances…) with their
 * contacts, and the documents (PDF, photos) kept in the app. Kept in
 * `ldb.voyages`, the files in the photo database.
 */

/** A person to reach about a contract (agent, base manager, assistance…). */
export interface VoyagePerson {
  id: string;
  /** First and last name. */
  nom: string;
  /** What the person does (« chef de base », « conseiller »…). */
  role: string;
  tel: string;
  mail: string;
}

/** One contract: an agency, a renter, an insurance… */
export interface VoyageCard {
  id: string;
  /** Its type, shown as its title (« Assurance annulation »). */
  title: string;
  /** Company or office. */
  org: string;
  /** Contract or policy number. */
  ref: string;
  adresse: string;
  tel: string;
  mail: string;
  /** Web site. */
  web: string;
  /** Emergency number (assistance, 24 h / 24). */
  urgence: string;
  notes: string;
  persons: VoyagePerson[];
}

/** A category of the contracts (Agence, Loueur, Assurances…). */
export interface VoyageCategory {
  id: string;
  name: string;
  cards: VoyageCard[];
}

/** A crew line of the cruise: a card of data › Équipiers·ères and a role. */
export interface VoyageCrewLine {
  memberId: string;
  fonction: string;
}

/** A PDF or a photo kept in the app; its content is in the photo database. */
export interface VoyageDoc {
  /** Id in the photo database. */
  id: string;
  /** Category id, {@link CREW_CAT} or {@link OTHER_CAT}. */
  cat: string;
  title: string;
  /** File name when imported. */
  name: string;
  /** Media type. */
  type: string;
  /** ISO time of the import. */
  at: string;
}

/** Everything of data › Croisières. */
export interface Voyages {
  crew: VoyageCrewLine[];
  categories: VoyageCategory[];
  docs: VoyageDoc[];
  /** ISO time of the last change (the newer one wins in a restoration). */
  mod: string;
}

/** Document category of the crew (identity cards, licences…). */
export const CREW_CAT = 'crew';
/** Document category of everything else. */
export const OTHER_CAT = 'other';

/** Roles of the cruise crew. */
export const VOYAGE_ROLES: readonly string[] = [
  'Skipper',
  'Second',
  'Équipier',
];

/** The fields of a contract, in the order shown: key, label, link kind. */
export const CARD_FIELDS: ReadonlyArray<
  readonly [
    key:
      'org' | 'ref' | 'adresse' | 'tel' | 'urgence' | 'mail' | 'web' | 'notes',
    label: string,
    kind: 'text' | 'tel' | 'mail' | 'web' | 'area',
  ]
> = [
  ['org', 'Société, agence', 'text'],
  ['ref', 'N° de contrat ou de police', 'text'],
  ['adresse', 'Adresse', 'text'],
  ['tel', 'Téléphone', 'tel'],
  ['urgence', 'Urgence, assistance 24 h / 24', 'tel'],
  ['mail', 'Courriel', 'mail'],
  ['web', 'Site internet', 'web'],
  ['notes', 'Notes (garanties, franchise, montant…)', 'area'],
];

/** The fields of a person: key, label, link kind. */
export const PERSON_FIELDS: ReadonlyArray<
  readonly [
    key: 'nom' | 'role' | 'tel' | 'mail',
    label: string,
    kind: 'text' | 'tel' | 'mail',
  ]
> = [
  ['nom', 'Prénom nom', 'text'],
  ['role', 'Rôle', 'text'],
  ['tel', 'Téléphone', 'tel'],
  ['mail', 'Courriel', 'mail'],
];

/**
 * A new contract.
 * @param id - Its id.
 * @param title - Its type.
 * @returns The empty contract.
 */
export function emptyCard(id: string, title: string): VoyageCard {
  return {
    id,
    title,
    org: '',
    ref: '',
    adresse: '',
    tel: '',
    mail: '',
    web: '',
    urgence: '',
    notes: '',
    persons: [],
  };
}

/**
 * A new person.
 * @param id - Its id.
 * @returns The empty person.
 */
export function emptyPerson(id: string): VoyagePerson {
  return { id, nom: '', role: '', tel: '', mail: '' };
}

/**
 * What data › Croisières holds before any change: the agency, the renter,
 * and the cancellation and deposit buy-back insurances.
 * @returns The default content.
 */
export function defaultVoyages(): Voyages {
  return {
    crew: [],
    categories: [
      { id: 'agence', name: 'Agence', cards: [emptyCard('agence1', 'Agence')] },
      { id: 'loueur', name: 'Loueur', cards: [emptyCard('loueur1', 'Loueur')] },
      {
        id: 'assurances',
        name: 'Assurances',
        cards: [
          emptyCard('annulation', 'Assurance annulation'),
          emptyCard('caution', 'Rachat de caution'),
        ],
      },
    ],
    docs: [],
    mod: '',
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function list(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map(record).filter((item) => item !== null)
    : [];
}

function cleanPerson(raw: Record<string, unknown>): VoyagePerson | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    nom: text(raw.nom),
    role: text(raw.role),
    tel: text(raw.tel),
    mail: text(raw.mail),
  };
}

function cleanCard(raw: Record<string, unknown>): VoyageCard | null {
  const id = text(raw.id);
  if (!id) return null;
  const card = emptyCard(id, text(raw.title));
  for (const [key] of CARD_FIELDS) card[key] = text(raw[key]);
  card.persons = list(raw.persons)
    .map(cleanPerson)
    .filter((item) => item !== null);
  return card;
}

/**
 * Read stored or received content; anything malformed is dropped.
 * @param raw - Untrusted value.
 * @returns The content, or null when it is not one.
 */
export function cleanVoyages(raw: unknown): Voyages | null {
  const value = record(raw);
  if (!value || !Array.isArray(value.categories)) return null;
  const categories: VoyageCategory[] = [];
  for (const item of list(value.categories)) {
    const id = text(item.id);
    if (!id) continue;
    categories.push({
      id,
      name: text(item.name),
      cards: list(item.cards)
        .map(cleanCard)
        .filter((card) => card !== null),
    });
  }
  const crew: VoyageCrewLine[] = [];
  for (const item of list(value.crew)) {
    const memberId = text(item.memberId);
    if (memberId && !crew.some((line) => line.memberId === memberId)) {
      crew.push({ memberId, fonction: text(item.fonction) || 'Équipier' });
    }
  }
  const docs: VoyageDoc[] = [];
  for (const item of list(value.docs)) {
    const id = text(item.id);
    if (!id) continue;
    docs.push({
      id,
      cat: text(item.cat) || OTHER_CAT,
      title: text(item.title),
      name: text(item.name),
      type: text(item.type),
      at: text(item.at),
    });
  }
  return { crew, categories, docs, mod: text(value.mod) };
}

/**
 * The document categories, in the order shown: those of the contracts, then
 * Équipage and Autres.
 * @param voyages - The content.
 * @returns Id and name of each.
 */
export function docCategories(
  voyages: Pick<Voyages, 'categories'>,
): Array<{ id: string; name: string }> {
  return [
    ...voyages.categories.map(({ id, name }) => ({
      id,
      name: name || 'Sans nom',
    })),
    { id: CREW_CAT, name: 'Équipage' },
    { id: OTHER_CAT, name: 'Autres' },
  ];
}

/**
 * The category a document is shown in: its own, or Autres when its category
 * was deleted.
 * @param voyages - The content.
 * @param doc - The document.
 * @returns The category id.
 */
export function docCategoryOf(
  voyages: Pick<Voyages, 'categories'>,
  doc: Pick<VoyageDoc, 'cat'>,
): string {
  return docCategories(voyages).some((cat) => cat.id === doc.cat)
    ? doc.cat
    : OTHER_CAT;
}

/** A titled table, as the shared image and PDF draw it. */
export interface VoyageSection {
  title: string;
  rows: Array<readonly [string, string]>;
}

/**
 * The contracts of some categories as tables, empty lines left out.
 * @param categories - The categories to share.
 * @returns One table per contract.
 */
export function contractSections(
  categories: readonly VoyageCategory[],
): VoyageSection[] {
  const sections: VoyageSection[] = [];
  for (const category of categories) {
    for (const card of category.cards) {
      const rows: Array<readonly [string, string]> = [];
      for (const [key, label] of CARD_FIELDS) {
        const value = card[key].trim();
        if (value) rows.push([label, value]);
      }
      for (const person of card.persons) {
        const parts = [person.role, person.tel, person.mail]
          .map((part) => part.trim())
          .filter(Boolean);
        if (person.nom.trim() || parts.length > 0) {
          rows.push([person.nom.trim() || 'Contact', parts.join(' · ')]);
        }
      }
      const name = category.name || 'Sans nom';
      const title = card.title.trim();
      sections.push({
        title: title && title !== name ? `${name} · ${title}` : name,
        rows: rows.length > 0 ? rows : [['', 'à compléter']],
      });
    }
  }
  return sections;
}

/**
 * The lines that are filled in a contract, for its band.
 * @param card - The contract.
 * @returns How many fields and persons are filled.
 */
export function filledCount(card: VoyageCard): number {
  return (
    CARD_FIELDS.filter(([key]) => card[key].trim()).length + card.persons.length
  );
}

/**
 * Which content wins when a backup brings one: the newer change.
 * @param kept - Content of this device.
 * @param received - Content of the file.
 * @returns The content to keep, with the documents of both.
 */
export function mergedVoyages(kept: Voyages, received: Voyages): Voyages {
  const newer = (received.mod || '') > (kept.mod || '') ? received : kept;
  const older = newer === received ? kept : received;
  const docs = [...newer.docs];
  for (const doc of older.docs) {
    if (!docs.some((item) => item.id === doc.id)) docs.push(doc);
  }
  return { ...newer, docs };
}
