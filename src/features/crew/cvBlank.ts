import { uid } from '../../lib/format.ts';
import type { CvCert, CvTrip, MemberCv } from '../../model/memberCv.ts';

import { normLabel } from './blankParse.ts';

/** First line of the CV to fill in, recognised when it comes back. */
export const CV_HEAD = 'NavIn · CV nautique à remplir';

/** The rules read before filling it in. */
const RULES = [
  '📌 À LIRE AVANT DE REMPLIR',
  '1️⃣ Réponds à ce mail en gardant ce texte, et écris chaque réponse juste APRÈS les deux-points « : », sur la même ligne.',
  '2️⃣ Ne change RIEN avant les « : » et n’efface aucune ligne « — … — » : c’est grâce à elles que NavIn reprend ton CV tel quel et l’enregistre.',
  '3️⃣ Une navigation par bloc « — Navigation — ». Il en faut plus ? Copie un bloc entier, du titre jusqu’à « Milles ». Un bloc en trop : laisse-le vide.',
  '4️⃣ Rien n’est obligatoire : laisse vide ce que tu ne sais pas. Une phrase seule suffit aussi (« Grèce, 2 semaines chaque été »).',
  '5️⃣ Année ou période : « 2024 », « 1996 – 1998 », « Dès 2015 ».',
];

/** Lines of the person and of what renters ask. */
const HEAD_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['prenom', 'Prénom'],
  ['nom', 'Nom'],
  ['intro', 'Présentation en quelques mots'],
  ['daysPerYear', 'Jours de navigation par an'],
  [
    'charterSkipper',
    'As-tu déjà loué un bateau comme chef de bord (oui ou non)',
  ],
  ['owner', 'Es-tu ou as-tu été propriétaire d’un bateau (oui ou non)'],
  ['ownerYears', 'Si oui, combien d’années'],
  ['ownerType', 'Si oui, type de bateau'],
  ['ownerLength', 'Si oui, longueur'],
  ['ownerPlace', 'Si oui, lieu'],
  ['place', 'Ville écrite en bas du CV'],
];

/** Lines of a navigation. */
const TRIP_FIELDS: ReadonlyArray<readonly [keyof CvTrip, string]> = [
  ['waters', 'Mer ou lac'],
  ['when', 'Année ou période'],
  ['boat', 'Bateau (modèle)'],
  ['boatType', 'Type (monocoque, catamaran…)'],
  ['role', 'Rôle à bord (skipper, second, équipier…)'],
  ['route', 'Itinéraire ou zone'],
  ['charter', 'Loueur'],
  ['duration', 'Durée'],
  ['nm', 'Milles parcourus'],
];

/** Lines of a licence. */
const CERT_FIELDS: ReadonlyArray<readonly [keyof CvCert, string]> = [
  ['label', 'Brevet, certificat ou formation'],
  ['when', 'Année'],
];

/** Blocks of navigations and of licences in the CV sent. */
const TRIPS_SENT = 5;
const CERTS_SENT = 3;

/**
 * The CV to fill in, sent by mail.
 * @param name - First and last name already known, written in.
 * @param name.prenom - First name.
 * @param name.nom - Last name.
 * @returns The text.
 */
export function cvBlankText(
  name: { prenom?: string; nom?: string } = {},
): string {
  const line = ([key, label]: readonly [string, string]) =>
    `${label} : ${key === 'prenom' ? (name.prenom ?? '') : key === 'nom' ? (name.nom ?? '') : ''}`;
  const blocks: string[] = [];
  for (let index = 0; index < TRIPS_SENT; index++) {
    blocks.push(
      '',
      '— Navigation —',
      ...TRIP_FIELDS.map(([, label]) => `${label} : `),
    );
  }
  for (let index = 0; index < CERTS_SENT; index++) {
    blocks.push(
      '',
      '— Brevet —',
      ...CERT_FIELDS.map(([, label]) => `${label} : `),
    );
  }
  return [
    CV_HEAD,
    '',
    ...RULES,
    '',
    '— Toi —',
    ...HEAD_FIELDS.map(line),
    ...blocks,
    '',
    '— Fin du CV, merci ! —',
    '',
  ].join('\n');
}

/**
 * A CV written in the text to fill in, its answers in: the same text is read
 * back by {@link parseCvBlank}.
 * @param name - First and last name.
 * @param name.prenom - First name.
 * @param name.nom - Last name.
 * @param cv - The CV.
 * @returns The text.
 */
export function cvFilledText(
  name: { prenom: string; nom: string },
  cv: MemberCv,
): string {
  const head = cv as Record<string, string | undefined>;
  const lines = [
    CV_HEAD,
    '',
    '— Toi —',
    ...HEAD_FIELDS.map(
      ([key, label]) =>
        `${label} : ${key === 'prenom' ? name.prenom : key === 'nom' ? name.nom : (head[key] ?? '')}`,
    ),
  ];
  for (const trip of cv.trips ?? []) {
    const values = trip as unknown as Record<string, string | undefined>;
    lines.push(
      '',
      '— Navigation —',
      ...TRIP_FIELDS.map(
        ([key, label]) =>
          `${label} : ${key === 'waters' ? (trip.waters === 'lac' ? 'Lac' : 'Mer') : (values[key] ?? '')}`,
      ),
    );
  }
  for (const cert of cv.certs ?? []) {
    lines.push(
      '',
      '— Brevet —',
      ...CERT_FIELDS.map(([key, label]) => `${label} : ${cert[key] ?? ''}`),
    );
  }
  lines.push('', '— Fin du CV —', '');
  return lines.join('\n');
}

/** A CV read from a mail, with the name it was sent for. */
export interface ReceivedCv {
  prenom: string;
  nom: string;
  cv: MemberCv;
}

const HEAD_LABELS = HEAD_FIELDS.map(
  ([key, label]) => [key, normLabel(label)] as const,
);
const TRIP_LABELS = TRIP_FIELDS.map(
  ([key, label]) => [key, normLabel(label)] as const,
);
const CERT_LABELS = CERT_FIELDS.map(
  ([key, label]) => [key, normLabel(label)] as const,
);

/**
 * Whether a text is a CV sent back.
 * @param text - Pasted text.
 * @returns True with the head of the CV.
 */
export function isCvBlank(text: string): boolean {
  return normLabel(text).includes(normLabel(CV_HEAD));
}

/**
 * Read the CVs of a pasted mail: each « NavIn · CV nautique » starts one,
 * each « — Navigation — » a navigation, each « — Brevet — » a licence; the
 * empty blocks are left out. Lines quoted by the mail (« > ») are read too.
 * @param text - Pasted text.
 * @returns The CVs with a first or last name.
 */
export function parseCvBlank(text: string): ReceivedCv[] {
  const found: ReceivedCv[] = [];
  let current: ReceivedCv | null = null;
  let block: 'head' | 'trip' | 'cert' = 'head';
  let trip: Partial<CvTrip> = {};
  let cert: Partial<CvCert> = {};
  let last: { set: (value: string, more?: boolean) => void } | null = null;
  const closeBlock = () => {
    if (!current) return;
    if (block === 'trip' && Object.values(trip).some(Boolean)) {
      current.cv.trips = [...(current.cv.trips ?? []), finishTrip(trip)];
    }
    if (block === 'cert' && Object.values(cert).some(Boolean)) {
      current.cv.certs = [...(current.cv.certs ?? []), { id: uid(), ...cert }];
    }
    trip = {};
    cert = {};
  };
  for (const raw of text.replaceAll('\r', '').split('\n')) {
    const line = raw.replace(/^[\s>]+/, '').trimEnd();
    const plain = normLabel(line);
    if (plain.startsWith(normLabel(CV_HEAD))) {
      closeBlock();
      current = { prenom: '', nom: '', cv: {} };
      found.push(current);
      block = 'head';
      last = null;
      continue;
    }
    if (!current) continue;
    if (/^[—–]/.test(line.trim())) {
      closeBlock();
      block = plain.startsWith('navigation')
        ? 'trip'
        : plain.startsWith('brevet')
          ? 'cert'
          : 'head';
      last = null;
      continue;
    }
    const colon = line.indexOf(':');
    const label = colon > 0 ? normLabel(line.slice(0, colon)) : '';
    const value = colon > 0 ? line.slice(colon + 1).trim() : '';
    const target = labelTarget(block, label, current, trip, cert);
    if (target) {
      last = target;
      if (value) target.set(value);
      continue;
    }
    // A long answer going on on the next line.
    if (last && line.trim() && !/^\d️⃣|^📌/u.test(line.trim())) {
      last.set(line.trim(), true);
    }
  }
  closeBlock();
  return found.filter((one) => one.prenom || one.nom);
}

/**
 * An answer, or its next line added to it.
 * @param before - The answer so far.
 * @param value - The new text.
 * @param more - A next line of the same answer.
 * @returns The answer.
 */
function add(
  before: string | undefined,
  value: string,
  more?: boolean,
): string {
  return more && before ? `${before} ${value}` : value;
}

function labelTarget(
  block: 'head' | 'trip' | 'cert',
  label: string,
  current: ReceivedCv,
  trip: Partial<CvTrip>,
  cert: Partial<CvCert>,
): { set: (value: string, more?: boolean) => void } | null {
  if (!label) return null;
  if (block === 'head') {
    const key = HEAD_LABELS.find(([, text]) => text === label)?.[0];
    if (!key) return null;
    return {
      set: (value, more) => {
        if (key === 'prenom' || key === 'nom') {
          current[key] = add(current[key], value, more);
          return;
        }
        const cv = current.cv as Record<string, string | undefined>;
        cv[key] = ['charterSkipper', 'owner'].includes(key)
          ? yesNo(value)
          : add(cv[key], value, more);
      },
    };
  }
  if (block === 'trip') {
    const key = TRIP_LABELS.find(([, text]) => text === label)?.[0];
    if (!key) return null;
    return {
      set: (value, more) => {
        const kept = trip as Record<string, string | undefined>;
        kept[key] = add(kept[key], value, more);
      },
    };
  }
  const key = CERT_LABELS.find(([, text]) => text === label)?.[0];
  if (!key) return null;
  return {
    set: (value, more) => {
      const kept = cert as Record<string, string | undefined>;
      kept[key] = add(kept[key], value, more);
    },
  };
}

function yesNo(value: string): string {
  const plain = normLabel(value);
  if (/^(?:oui|yes|o|y)\b/.test(plain)) return 'Oui';
  if (/^(?:non|no|n)\b/.test(plain)) return 'Non';
  return value;
}

function finishTrip(trip: Partial<CvTrip>): CvTrip {
  const waters = normLabel(trip.waters ?? '').startsWith('lac') ? 'lac' : 'mer';
  const kept: CvTrip = { id: uid(), waters };
  for (const [key, value] of Object.entries(trip)) {
    if (key !== 'waters' && value) Object.assign(kept, { [key]: value });
  }
  return kept;
}

/**
 * A CV received put into the one of a card: its navigations and licences
 * added, its answers taken where the card had none.
 * @param before - The CV of the card.
 * @param received - The CV received.
 * @returns The CV to save.
 */
export function mergeCv(
  before: MemberCv | undefined,
  received: MemberCv,
): MemberCv {
  const merged: MemberCv = { ...received, ...before };
  for (const [key, value] of Object.entries(received)) {
    if (key === 'trips' || key === 'certs') continue;
    const kept = merged as Record<string, unknown>;
    if (!kept[key]) kept[key] = value;
  }
  merged.trips = [...(before?.trips ?? []), ...(received.trips ?? [])];
  merged.certs = [...(before?.certs ?? []), ...(received.certs ?? [])];
  return merged;
}
