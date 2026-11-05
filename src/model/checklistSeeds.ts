import type { ChecklistItem } from './types.ts';

/** A checklist item of a base, before it gets an id. */
export interface SeedItem {
  label: string;
  /**
   * Explanation shown under the item.
   * @default undefined
   */
  note?: string;
}

/**
 * Base items from `[label, note]` rows (an empty note is left out).
 * @param rows - Labels and notes.
 * @returns The items.
 */
export function toSeedItems(
  rows: ReadonlyArray<readonly [string, string]>,
): SeedItem[] {
  return rows.map(([label, note]) => (note ? { label, note } : { label }));
}

/**
 * Numbered checklist items from labels (legacy `seedList`); `[label, action]` pairs keep their action.
 * @param rows - Labels or `[label, action]`.
 * @param prefix - Id prefix (ids are prefix + 1-based position).
 * @returns The items.
 */
export function seedList(
  rows: ReadonlyArray<string | readonly [string, string]>,
  prefix: string,
): ChecklistItem[] {
  return rows.map((row, position) =>
    typeof row === 'string'
      ? { id: `${prefix}${position + 1}`, label: row }
      : { id: `${prefix}${position + 1}`, label: row[0], action: row[1] },
  );
}

/** Leaving checklist of the Savannah. */
export const SAVANNAH_CHECK: ReadonlyArray<string | readonly [string, string]> =
  [
    'Couper la batterie du moteur',
    'Fermer tous les hublots',
    'Éteindre tous les appareils du panneau de commande au-dessus de la table à carte',
    'Laisser le frigo ouvert',
    'Couper le gaz à côté du four',
    'Couper le gaz sur la bonbonne du balcon arrière',
    [
      'Remplir la fiche du livre de bord et en envoyer une photo sur le groupe WhatsApp « Savannah entraînement ou location »',
      'sheet',
    ],
    'Prendre toutes vos affaires ;o)',
  ];

/** Suggested departure checks of a lake day outing. */
export const DEP_CHECK: readonly string[] = [
  'Consulter la météo et les feux d’avis de tempête',
  'Gilets de sauvetage pour tout l’équipage',
  'Sortir la bouée fer à cheval',
  'Vérifier le carburant',
];

/** Extra departure and end checks of a lake cruise. */
export const DEP_CHECK_X: readonly string[] = [
  'Fermer le frigo',
  'Faire le plein d’eau douce',
  'Vérifier la réserve de gaz',
  'Ranger l’avitaillement',
  'Literie et sacs de couchage à bord',
  'Essayer les feux de navigation',
];

/** Extra end checks of a lake cruise. */
export const QUIT_CHECK_X: readonly string[] = [
  'Vider et nettoyer le frigo',
  'Vider les poubelles',
  'Nettoyer cabines, carré et WC',
  'Noter le niveau de diesel et d’eau',
];

/** Sea charter: taking over and returning the boat. */
export const SEA_DEP: readonly string[] = [
  'Papiers du bateau, contrat et caution',
  'Inventaire du matériel avec le loueur',
  'Photos des dégâts existants avec le loueur',
  'Gilets de sauvetage (un par personne) et harnais',
  'Radeau de survie : date de révision',
  'Fusées et feux de détresse : dates de validité',
  'Extincteurs et couverture anti-feu',
  'Annexe, hors-bord, gonfleur et pagaies',
  'Moteur : huile, eau de refroidissement, courroie, filtre',
  'Niveaux : gasoil, eau douce, gaz',
  'Batteries et branchement de quai',
  'Guindeau, ancre et longueur de chaîne',
  'Voiles, enrouleur et bosses de ris',
  'VHF : essai radio, MMSI',
  'Feux de navigation',
  'Pompes de cale manuelle et électrique',
  'WC et vannes de coque',
];

/** Sea charter: returning the boat. */
export const SEA_QUIT: readonly string[] = [
  'Plein de gasoil (selon le contrat)',
  'Ranger et nettoyer cabines, carré et cuisine',
  'Vider le frigo et les poubelles',
  'Vider les eaux noires (si autorisé)',
  'Inventaire de restitution avec le loueur',
  'Signaler les avaries et les pertes',
  'Récupérer la caution',
  'Prendre toutes vos affaires',
];

/** Label of the arrival readings item. */
export const RELEVES_LABEL =
  'Mettre le contact, puis relever : heures moteur, carburant, tension des 2 batteries, niveau d’eau';

/** One arrival reading item per value, written in the day sheet (legacy `relevesItems`).
 * @param prefix - Id prefix.
 * @returns The items.
 */
export function relevesItems(prefix: string): ChecklistItem[] {
  const readings: ReadonlyArray<readonly [string, string, string]> = [
    ['moteurDebut', 'Allumer le moteur et relever les heures moteur', 'h'],
    ['carbPct', 'Checker le niveau de carburant', '%'],
    ['batt1', 'Tension de la batterie 1', 'V'],
    ['batt2', 'Tension de la batterie 2', 'V'],
    ['eauPct', 'Niveau d’eau potable', '%'],
  ];
  return [
    { id: `${prefix}c`, label: 'Mettre le contact' },
    ...readings.map(([key, label, unit]) => ({
      id: prefix + key,
      label,
      unit,
      key,
    })),
  ];
}

/** Arrival readings: `[day-sheet key, label, unit]`. */
export const RELEVES: ReadonlyArray<readonly [string, string, string]> = [
  ['moteurDebut', 'Heures moteur', 'h'],
  ['carbPct', 'Carburant', '%'],
  ['batt1', 'Batterie 1', 'V'],
  ['batt2', 'Batterie 2', 'V'],
  ['eauPct', 'Eau', '%'],
];

/** Units of a checklist value item (legacy `CK_UNITS`). */
export const CK_UNITS: readonly string[] = [
  '',
  '%',
  'L',
  'kWh',
  'V',
  'h',
  'bar',
  '°C',
  'nb',
];
