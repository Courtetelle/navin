import type { FieldDefinition } from './field.ts';

const PHONE_PLACEHOLDER = '+41 79 123 45 67';

function phoneField(
  key: string,
  label: string,
  frame: string,
): FieldDefinition {
  return {
    key,
    label,
    type: 'line',
    inputmode: 'tel',
    placeholder: PHONE_PLACEHOLDER,
    phone: true,
    wide: true,
    contact: 'tel',
    frame,
  };
}

function relativeName(
  key: string,
  label: string,
  frame: string,
): FieldDefinition {
  return { key, label, type: 'line', grow: true, wide: true, frame };
}

/** Fields of a crew line of a cruise (legacy `CREW_FIELDS`). */
export const CREW_FIELDS: readonly FieldDefinition[] = [
  {
    key: 'fonction',
    label: 'Fonction à bord',
    type: 'choice',
    options: [['Skipper'], ['Second'], ['Équipier']],
    wide: true,
  },
  { key: 'nom', label: 'Prénom nom', type: 'line', wide: true },
  {
    key: 'sexe',
    label: 'Coéquipier ou coéquipière',
    type: 'choice',
    options: [['Homme'], ['Femme'], ['Non genré']],
    cycle: true,
    free: true,
    wide: true,
    show: { '': '⚲', Homme: '♂', Femme: '♀', 'Non genré': '⚲' },
  },
  { key: 'naissance', label: 'Date de naissance', type: 'line', frame: 'nais' },
  {
    key: 'lieu',
    label: 'Lieu de naissance / d’origine',
    type: 'line',
    grow: true,
    wide: true,
    frame: 'nais',
    labelCycle: {
      key: 'lieuType',
      options: ['Lieu de naissance', 'Lieu d’origine'],
    },
  },
  { key: 'nationalite', label: 'Nationalité', type: 'line', frame: 'nais' },
  phoneField('tel', 'Téléphone (avec indicatif, ex. +41)', 'contact'),
  {
    key: 'email',
    label: 'Courriel',
    type: 'line',
    inputmode: 'email',
    wide: true,
    contact: 'mail',
    frame: 'contact',
  },
  {
    key: 'piece',
    label: 'Passeport / carte ID (n°)',
    type: 'line',
    labelCycle: {
      key: 'pieceType',
      options: ['Passeport', 'Carte d’identité'],
      suffix: ' n°',
    },
    lock: true,
    frame: 'piece',
  },
  {
    key: 'expiration',
    label: 'Date d’expiration',
    type: 'line',
    expiry: true,
    placeholder: 'JJ.MM.AAAA',
    frame: 'piece',
  },
  {
    key: 'permis',
    label: 'Permis n°',
    type: 'line',
    lock: true,
    frame: 'permis',
  },
  {
    key: 'vhf',
    label: 'Licence VHF n°',
    type: 'line',
    lock: true,
    frame: 'permis',
  },
  {
    key: 'emisPar',
    label: 'Permis établi par',
    type: 'line',
    wide: true,
    frame: 'permis',
  },
  { key: 'adresse', label: 'Adresse postale', type: 'line', wide: true },
  { key: 'sante', label: 'Santé, allergies à connaître', type: 'area' },
  relativeName('procheNom', 'Proche à contacter : prénom et nom', 'p1'),
  phoneField('procheTel', 'Téléphone du proche', 'p1'),
  relativeName('proche2Nom', '2ᵉᵐᵉ proche : prénom et nom', 'p2'),
  phoneField('proche2Tel', 'Téléphone du 2ᵉᵐᵉ proche', 'p2'),
  relativeName('proche3Nom', '3ᵉᵐᵉ proche : prénom et nom', 'p3'),
  phoneField('proche3Tel', 'Téléphone du 3ᵉᵐᵉ proche', 'p3'),
];

/** Fields of a member card: crew fields without the role and the full name (legacy `MEMBER_FIELDS`). */
export const MEMBER_FIELDS: readonly FieldDefinition[] = CREW_FIELDS.filter(
  (field) => !['fonction', 'nom'].includes(field.key),
);

/** Keys saved on a member card (legacy `MEMBER_KEYS`). */
export const MEMBER_KEYS: readonly string[] = [
  ...MEMBER_FIELDS.map((field) => field.key),
  'pieceType',
  'lieuType',
];

/** Roles of a lake outing: `[stored value, label]`. */
export const LAKE_ROLES: ReadonlyArray<readonly [string, string]> = [
  ['Skipper', 'Skipper'],
  ['Second', 'Second'],
  ['Équipier', 'Équipier'],
];

/** Roles of a sea cruise: `[stored value, label]`. */
export const SEA_ROLES: ReadonlyArray<readonly [string, string]> = [
  ['Skipper', 'Skipper'],
  ['Second', 'Second'],
  ['Équipier', 'Équipier'],
];

const FEMININE_ROLES: Readonly<Record<string, string>> = {
  Second: 'Seconde',
  Équipier: 'Équipière',
};

/**
 * Role label agreed with the member's gender (legacy `roleLabel`).
 * @param role - Stored role.
 * @param sex - `sexe` of the member.
 * @returns e.g. `Équipière` for a woman.
 */
export function roleLabel(role: string | undefined, sex?: unknown): string {
  const found = LAKE_ROLES.find(([value]) => value === role);
  const label = (found ? found[1] : role) || '';
  return sex === 'Femme' ? FEMININE_ROLES[label] || label : label;
}
