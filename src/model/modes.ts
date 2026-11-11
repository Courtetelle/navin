import type { Cruise } from './types.ts';

/** The three navigation modes: sea charter, lake day outing, lake cruise. */
export type ModeKey = 'mer' | 'lacj' | 'lacc';

/** Display of a mode. */
interface ModeDefinition {
  icon: string;
  name: string;
  sub: string;
}

/** Modes (legacy `MODES`). */
export const MODES: Readonly<Record<ModeKey, ModeDefinition>> = {
  mer: { icon: '⛵', name: 'Croisière en mer', sub: 'location à la semaine' },
  lacj: { icon: '🏞', name: 'Lac · journée', sub: 'sortie du jour' },
  lacc: { icon: '🌙', name: 'Lac · croisière', sub: 'plusieurs jours' },
};

/**
 * Mode of a cruise (legacy `modeOf`).
 * @param cruise - Cruise, or null.
 * @returns `'lacc'` / `'lacj'` for lake outings, `'mer'` otherwise.
 */
export function modeOf(
  cruise: Pick<Cruise, 'type' | 'duree'> | null | undefined,
): ModeKey {
  if (!cruise) return 'mer';
  if (cruise.type !== 'lac') return 'mer';
  return cruise.duree === 'croisiere' ? 'lacc' : 'lacj';
}

/** Built-in checklists of a mode: `[list id, owner property, default name]`. */
export type ChecklistSlot = readonly [string, string, string];

/** Built-in checklists of each mode (legacy `CK_DEFS`). */
export const CK_DEFS: Readonly<Record<ModeKey, readonly ChecklistSlot[]>> = {
  mer: [
    ['dep', 'checklistDep', 'Prise du bateau'],
    ['quit', 'checklist', 'Restitution'],
  ],
  lacj: [
    ['dep', 'checklistDep', 'Arrivée à bord'],
    ['quit', 'checklist', 'Quitter le bateau'],
  ],
  lacc: [
    ['dep', 'checklistDepX', 'Arrivée à bord'],
    ['quit', 'checklistX', 'Fin de croisière'],
  ],
};

/** Default categories of the built-in checklists (legacy `CK_BUILTIN_CATS`). */
export const CK_BUILTIN_CATS: Readonly<
  Record<ModeKey, { dep: readonly string[]; quit: readonly string[] }>
> = {
  mer: { dep: ['Check-in', 'Croisière'], quit: ['Check-out', 'Croisière'] },
  lacj: { dep: ['Check-in', 'Léman'], quit: ['Check-out', 'Léman'] },
  lacc: {
    dep: ['Check-in', 'Croisière', 'Léman'],
    quit: ['Check-out', 'Croisière', 'Léman'],
  },
};

/** Default checklist categories (legacy `CK_CATS_DEFAULT`). */
export const CK_CATS_DEFAULT: readonly string[] = [
  'Check-in',
  'Check-out',
  'Croisière',
  'Léman',
  'Mer',
  'Avitaillement',
  'Sécurité',
  'Mouillage',
  'Entretien',
];

/**
 * The list is one of the two built-in lists (legacy `isCkBuiltin`).
 * @param list - List id.
 * @returns `true` for `'dep'` and `'quit'`.
 */
export function isCkBuiltin(list: string): boolean {
  return list === 'dep' || list === 'quit';
}

/** Purposes of a lake outing: `[name, icon, sub-label]` (legacy `PREP_PURPOSES`). */
export const PREP_PURPOSES: ReadonlyArray<readonly [string, string, string]> = [
  ['Entraînement', '🎯', 'entre membres'],
  ['Location', '🔑', 'tarif calculé'],
  ['Invitation', '🤝', 'invités à bord'],
];

/** Steps of the PréP flow (legacy `PREP_STEPS`). */
export const PREP_STEPS: readonly string[] = [
  'Sortie',
  'Durée',
  'Bateau',
  'Équipage',
  'Check-in',
  'Départ',
];
