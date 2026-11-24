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
  /** The cruise itself: ports, dates, VHF, weather (keys of {@link INFO_FIELDS}). */
  info: Record<string, string>;
  crew: VoyageCrewLine[];
  categories: VoyageCategory[];
  docs: VoyageDoc[];
  /** Photo id of the medallion of the cruise (base photos), if any. */
  photo?: string;
  /** The crew of the cruise: a saved crew of data › Équipages (its id). */
  crewSet?: string;
  /** The boat of the cruise: one of data › Bateaux (its id). */
  boat?: string;
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
  ['notes', 'Notes : tarifs, règlement, garanties, franchise…', 'area'],
];

/**
 * The fields of the cruise itself, taken from « Bateau et croisière »: key,
 * label, kind. They go into the navigations of the cruise (VHF, SOS, CV).
 */
export const INFO_FIELDS: ReadonlyArray<
  readonly [key: string, label: string, kind: 'text' | 'date' | 'area']
> = [
  ['ports', 'Port de départ et d’arrivée', 'text'],
  ['du', 'Du', 'date'],
  ['au', 'Au', 'date'],
  ['vhfMarina', 'Canal VHF de la marina', 'text'],
  ['coastStation', 'Station côtière radio', 'text'],
  [
    'meteo',
    'Météo : bulletins VHF (canaux, horaires), sites, heure légale',
    'area',
  ],
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
    info: {},
    crew: [],
    categories: [
      { id: 'agence', name: 'Agence', cards: [emptyCard('agence1', 'Agence')] },
      { id: 'loueur', name: 'Loueur', cards: [emptyCard('loueur1', 'Loueur')] },
      {
        id: 'courtiers',
        name: 'Courtiers',
        cards: [emptyCard('courtier1', 'Courtier')],
      },
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
  const info: Record<string, string> = {};
  const rawInfo = record(value.info);
  for (const [key] of INFO_FIELDS) {
    const kept = text(rawInfo?.[key]);
    if (kept) info[key] = kept;
  }
  const out: Voyages = { info, crew, categories, docs, mod: text(value.mod) };
  for (const key of ['photo', 'crewSet', 'boat'] as const) {
    const kept = text(value[key]);
    if (kept) out[key] = kept;
  }
  return out;
}

/**
 * The photos of a cruise kept in the photo base: its documents and its
 * medallion.
 * @param voyages - The content.
 * @returns Their ids.
 */
export function voyagePhotoIds(
  voyages: Pick<Voyages, 'docs' | 'photo'>,
): string[] {
  return [
    ...voyages.docs.map((doc) => doc.id),
    ...(voyages.photo ? [voyages.photo] : []),
  ];
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
export function mergedVoyages<Content extends Voyages>(
  kept: Content,
  received: Content,
): Content {
  const newer = (received.mod || '') > (kept.mod || '') ? received : kept;
  const older = newer === received ? kept : received;
  const docs = [...newer.docs];
  for (const doc of older.docs) {
    if (!docs.some((item) => item.id === doc.id)) docs.push(doc);
  }
  return { ...newer, docs };
}

/** The sections a cruise can hold; more will come. */
export type VoyageSectionKey = 'info' | 'boat' | 'crew' | 'contracts' | 'docs';

/** Each section: key, view opened, title and text of its tile. */
export const VOYAGE_SECTIONS: ReadonlyArray<{
  key: VoyageSectionKey;
  view: string;
  title: string;
  sub: string;
}> = [
  {
    key: 'info',
    view: 'vinfo',
    title: '🧭 Croisière',
    sub: 'ports, dates, canaux VHF, station côtière, météo',
  },
  {
    key: 'boat',
    view: 'vboat',
    title: '🚤 Bateau',
    sub: 'choisi dans data › Bateaux',
  },
  {
    key: 'crew',
    view: 'vcrew',
    title: '👥 Équipage',
    sub: 'choisi dans data › Équipages',
  },
  {
    key: 'contracts',
    view: 'vcontracts',
    title: '📑 Contrats',
    sub: 'agence, loueur, assurances, contacts d’urgence',
  },
  {
    key: 'docs',
    view: 'vdocs',
    title: '📎 Documents',
    sub: 'contrats, conditions générales et particulières, photos',
  },
];

/** One cruise of data › Croisières: its number, name, sections and content. */
export interface Voyage extends Voyages {
  id: string;
  /** Automatic number, from the last one kept. */
  num: number;
  name: string;
  /** ISO creation time. */
  created: string;
  /** Sections chosen for this cruise, in the order of {@link VOYAGE_SECTIONS}. */
  sections: VoyageSectionKey[];
}

/** All the cruises, and the active one. */
export interface VoyageStore {
  list: Voyage[];
  /** The active cruise: new navigations, routes and routings go into it. */
  active: string | null;
  /** ISO time of the last change of the list or of the active cruise. */
  mod: string;
  /**
   * Version of the content: 2 since the section Croisière and the
   * category Courtiers, 3 since the section Bateau.
   * @default undefined
   */
  v?: number;
}

/** Version of {@link VoyageStore} written now. */
export const VOYAGE_STORE_V = 3;

/**
 * A cruise kept before version 3 gets the sections Croisière and Bateau
 * and the category Courtiers.
 * @param voyage - The cruise read.
 * @returns The cruise brought up to date.
 */
function upgraded(voyage: Voyage): Voyage {
  const sections = ALL_SECTIONS.filter(
    (key) => key === 'info' || key === 'boat' || voyage.sections.includes(key),
  );
  const categories = voyage.categories.some((cat) => cat.id === 'courtiers')
    ? voyage.categories
    : [
        ...voyage.categories,
        {
          id: 'courtiers',
          name: 'Courtiers',
          cards: [emptyCard(`${voyage.id}-courtier`, 'Courtier')],
        },
      ];
  return { ...voyage, sections, categories };
}

/** The sections every new cruise proposes, ticked. */
export const ALL_SECTIONS: readonly VoyageSectionKey[] = VOYAGE_SECTIONS.map(
  (section) => section.key,
);

function cleanSections(raw: unknown): VoyageSectionKey[] {
  if (!Array.isArray(raw)) return [...ALL_SECTIONS];
  return ALL_SECTIONS.filter((key) => raw.includes(key));
}

/**
 * Read one stored or received cruise.
 * @param raw - Untrusted value.
 * @returns The cruise, or null.
 */
export function cleanVoyage(raw: unknown): Voyage | null {
  const value = record(raw);
  const content = cleanVoyages(raw);
  const id = text(value?.id);
  if (!value || !content || !id) return null;
  const num = typeof value.num === 'number' && value.num > 0 ? value.num : 0;
  return {
    ...content,
    id,
    num,
    name: text(value.name) || `${num || ''} Croisière`.trim(),
    created: text(value.created),
    sections: cleanSections(value.sections),
  };
}

/**
 * Read the stored or received cruises. The first version kept one cruise
 * only (its content at the root): it becomes cruise 1.
 * @param raw - Untrusted value.
 * @returns The cruises, or null when it is none.
 */
export function cleanVoyageStore(raw: unknown): VoyageStore | null {
  const value = record(raw);
  if (!value) return null;
  if (Array.isArray(value.list)) {
    const list: Voyage[] = [];
    for (const item of value.list) {
      const voyage = cleanVoyage(item);
      if (voyage && !list.some((known) => known.id === voyage.id)) {
        list.push(voyage);
      }
    }
    const active = text(value.active);
    const old = typeof value.v !== 'number' || value.v < VOYAGE_STORE_V;
    return {
      list: old ? list.map(upgraded) : list,
      active: list.some((voyage) => voyage.id === active) ? active : null,
      mod: text(value.mod),
      v: VOYAGE_STORE_V,
    };
  }
  const single = cleanVoyages(raw);
  if (!single) return null;
  if (!single.mod) {
    return { list: [], active: null, mod: '', v: VOYAGE_STORE_V };
  }
  const year = (single.mod.slice(0, 4) || '').trim();
  const voyage: Voyage = {
    ...single,
    id: 'v1',
    num: 1,
    name: `1 Croisière ${year}`.trim(),
    created: single.mod,
    sections: [...ALL_SECTIONS],
  };
  return {
    list: [upgraded(voyage)],
    active: null,
    mod: single.mod,
    v: VOYAGE_STORE_V,
  };
}

/**
 * The number of a new cruise: one after the highest kept (its number, or
 * the number its name starts with).
 * @param list - The cruises.
 * @returns The number.
 */
export function nextVoyageNum(list: readonly Voyage[]): number {
  let highest = 0;
  for (const voyage of list) {
    const lead = /^\s*(?<n>\d+)/u.exec(voyage.name)?.groups?.n;
    highest = Math.max(highest, voyage.num, lead ? Number(lead) : 0);
  }
  return highest + 1;
}

/**
 * A new cruise: its number and automatic name, the sections chosen, empty,
 * keeping the categories and contract types of the last cruise (without
 * their contents).
 * @param list - The cruises kept.
 * @param options - Id, sections chosen and time.
 * @param options.id - Its id.
 * @param options.sections - Sections ticked.
 * @param options.now - Creation time.
 * @param options.newId - Makes the ids of the copied categories and cards.
 * @returns The cruise.
 */
export function blankVoyage(
  list: readonly Voyage[],
  {
    id,
    sections,
    now,
    newId,
  }: {
    id: string;
    sections: readonly VoyageSectionKey[];
    now: Date;
    newId: () => string;
  },
): Voyage {
  const num = nextVoyageNum(list);
  const last = list.toSorted((first, second) =>
    second.created.localeCompare(first.created),
  )[0];
  const base = defaultVoyages();
  const categories = last
    ? last.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        cards: cat.cards.map((card) => emptyCard(newId(), card.title)),
      }))
    : base.categories;
  return {
    ...base,
    categories,
    id,
    num,
    name: `${num} Nouvelle croisière ${now.getFullYear()}`,
    created: now.toISOString(),
    sections: ALL_SECTIONS.filter((key) => sections.includes(key)),
    mod: now.toISOString(),
  };
}

/**
 * The sections of all the cruises kept, proposed when one is created; all
 * of them when there is no cruise yet.
 * @param list - The cruises.
 * @returns The keys, in their order.
 */
export function knownSections(list: readonly Voyage[]): VoyageSectionKey[] {
  if (list.length === 0) return [...ALL_SECTIONS];
  return ALL_SECTIONS.filter((key) =>
    list.some((voyage) => voyage.sections.includes(key)),
  );
}

/**
 * Cruises from a backup or another device: unknown ones are added, a known
 * one keeps its newer change (with the documents of both); the active one
 * comes from the newer list.
 * @param kept - Cruises of this device.
 * @param received - Cruises of the file.
 * @returns The cruises to keep.
 */
export function mergedStores(
  kept: VoyageStore,
  received: VoyageStore,
): VoyageStore {
  const list = kept.list.map((voyage) => {
    const other = received.list.find((item) => item.id === voyage.id);
    return other ? mergedVoyages(voyage, other) : voyage;
  });
  for (const voyage of received.list) {
    if (!list.some((item) => item.id === voyage.id)) list.push(voyage);
  }
  const newer = (received.mod || '') > (kept.mod || '') ? received : kept;
  const active =
    newer.active && list.some((voyage) => voyage.id === newer.active)
      ? newer.active
      : null;
  return { list, active, mod: newer.mod, v: VOYAGE_STORE_V };
}

/**
 * What a cruise gives to its navigations: its ports, dates, VHF and weather,
 * and the renter's numbers for the SOS book (`base`, « Nom : numéro »).
 * @param voyage - The cruise.
 * @returns The values of `cruise.info` to set, empty ones left out.
 */
export function voyageNavInfo(
  voyage: Pick<Voyages, 'info' | 'categories'>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key] of INFO_FIELDS) {
    const value = voyage.info[key]?.trim();
    if (value) out[key] = value;
  }
  const lines: string[] = [];
  const renter = voyage.categories.find((cat) => cat.id === 'loueur');
  for (const card of renter?.cards ?? []) {
    const who = card.org.trim() || card.title.trim() || 'Loueur';
    if (card.tel.trim()) lines.push(`${who} : ${card.tel.trim()}`);
    if (card.urgence.trim()) {
      lines.push(`${who} urgence : ${card.urgence.trim()}`);
    }
    for (const person of card.persons) {
      if (!person.tel.trim()) continue;
      const name = [person.nom.trim(), person.role.trim()]
        .filter(Boolean)
        .join(', ');
      lines.push(`${name || who} : ${person.tel.trim()}`);
    }
  }
  if (lines.length > 0) out.base = lines.join('\n');
  return out;
}
