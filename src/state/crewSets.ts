import { produce } from 'immer';

import type { CrewSet, CrewSetLine } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';
import { examplesWanted } from './examplesWanted.ts';
import { memberName } from './members.ts';

/** Example crews built from the example member cards: `[id, name, [memberId, role][]]`. */
const EXAMPLE_CREWS: ReadonlyArray<
  readonly [string, string, ReadonlyArray<readonly [string, string]>]
> = [
  [
    'exc1',
    'Régate du jeudi',
    [
      ['ex2', 'Skipper'],
      ['ex1', 'Second'],
      ['ex5', 'Équipier'],
    ],
  ],
  [
    'exc2',
    'Croisière en Méditerranée',
    [
      ['ex6', 'Skipper'],
      ['ex4', 'Second'],
      ['ex3', 'Équipier'],
      ['ex2', 'Équipier'],
      ['ex1', 'Équipier'],
    ],
  ],
  [
    'exc3',
    'Sortie découverte',
    [
      ['ex4', 'Skipper'],
      ['ex3', 'Équipier'],
    ],
  ],
];

/** The example crews by id, with their name, to recognise them. */
export const EXAMPLE_CREW_IDS: Readonly<Record<string, string>> =
  Object.fromEntries(EXAMPLE_CREWS.map(([id, name]) => [id, name]));

/**
 * Load the crew compositions (prep.js 25-52): each gets an identifier `EQ001`…
 * and its signature; the example crews are added once (members must be loaded first).
 */
export function loadCrewSets(): void {
  const sets = store.arr<CrewSet>('ldb.crewSets', (set) => {
    if (!Array.isArray(set.crew)) set.crew = [];
    set.crew = set.crew.filter((line) => line && typeof line === 'object');
    return set;
  });
  for (const set of sets) {
    if (!set.ident) set.ident = crewSetIdent();
    if (set._sig === undefined) set._sig = crewSig(set);
  }
  store.set('ldb.crewSets', sets);
  data.crewSets.value = sets;
  if (!examplesWanted() || store.get('ldb.exCrews', false)) return;
  let added = 0;
  for (const [id, name, lines] of EXAMPLE_CREWS) {
    const crew: CrewSetLine[] = lines
      .filter(([memberId]) =>
        data.members.value.some((member) => member.id === memberId),
      )
      .map(([memberId, fonction]) => ({ memberId, fonction }));
    if (crew.length > 0 && !sets.some((set) => set.id === id)) {
      sets.push({ id, ident: crewSetIdent(), name, crew });
      added++;
    }
  }
  if (added) saveCrewSets();
  store.set('ldb.exCrews', true);
}

/**
 * Signature of a composition: name and members with their roles (legacy `crewSig`).
 * @param set - Composition.
 * @returns JSON signature.
 */
export function crewSig(set: Pick<CrewSet, 'name' | 'crew'>): string {
  return JSON.stringify([
    set.name || '',
    (set.crew || []).map((line) => [line.memberId, line.fonction || '']),
  ]);
}

/**
 * Members and roles of a crew list, order ignored (legacy `crewFull`).
 * @param lines - Crew lines.
 * @returns JSON signature.
 */
export function crewFull(
  lines: readonly CrewSetLine[] | null | undefined,
): string {
  return JSON.stringify(
    (lines || [])
      .map((line) => [line.memberId, line.fonction || ''])
      .toSorted((a, b) => compareText(a.join(','), b.join(','))),
  );
}

/**
 * Persist the compositions, stamping creation (`at`) and change (`mod`) times
 * from their signature (legacy `saveCrewSets`).
 */
export function saveCrewSets(): void {
  const now = new Date().toISOString();
  data.crewSets.value = produce(data.crewSets.value, (sets) => {
    for (const set of sets) {
      const signature = crewSig(set);
      if (set._sig === undefined) {
        set.at = set.at || now;
        set._sig = signature;
      } else if (set._sig !== signature) {
        set.mod = now;
        set._sig = signature;
      }
    }
  });
  store.set('ldb.crewSets', data.crewSets.value);
  store.set('ldb.crewSets.at', now);
}

/**
 * Change the compositions with an immer recipe, then save them.
 * @param recipe - Mutates the draft list.
 */
export function updateCrewSets(recipe: (sets: CrewSet[]) => void): void {
  data.crewSets.value = produce(data.crewSets.value, recipe);
  saveCrewSets();
}

/**
 * Next unique composition identifier `EQ001`… (legacy `crewSetIdent`).
 * @returns The identifier.
 */
export function crewSetIdent(): string {
  const next = store.get('ldb.crewSeq', 0) + 1;
  store.set('ldb.crewSeq', next);
  return `EQ${String(next).padStart(3, '0')}`;
}

/**
 * "créé le DD.MM.YYYY" or "modifié le DD.MM.YYYY" (legacy `crewSetDate`).
 * @param set - Composition.
 * @returns The text, or `''` without date.
 */
export function crewSetDate(set: Pick<CrewSet, 'at' | 'mod'>): string {
  const iso = set.mod || set.at;
  if (!iso) return '';
  const date = new Date(iso);
  return `${set.mod ? 'modifié' : 'créé'} le ${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

/**
 * First names of a composition (legacy `crewSetPeople`).
 * @param set - Composition.
 * @returns e.g. `Thomas, Camille`.
 */
export function crewSetPeople(set: Pick<CrewSet, 'crew'>): string {
  return set.crew
    .map((line) => {
      const member = data.members.value.find(
        (item) => item.id === line.memberId,
      );
      return member ? member.prenom || memberName(member) : '?';
    })
    .join(', ');
}

/**
 * Name of a composition: its name, else its identifier, else its people (legacy `crewSetName`).
 * @param set - Composition.
 * @returns The name.
 */
export function crewSetName(set: CrewSet): string {
  return set.name || set.ident || crewSetPeople(set);
}

/**
 * Compositions (and the open cruise) a member belongs to (legacy `memberLocks`).
 * @param id - Member id.
 * @returns Their identifiers; `navigation en cours` for the open cruise.
 */
export function memberLocks(id: string): string[] {
  const locks = data.crewSets.value
    .filter((set) => (set.crew || []).some((line) => line.memberId === id))
    .map((set) => set.ident || set.name || 'équipage');
  if ((data.cruise.value?.crew || []).some((line) => line.memberId === id)) {
    locks.push('navigation en cours');
  }
  return locks;
}

/**
 * Why a member card cannot be deleted (legacy `memberLockMsg`).
 * @param id - Member id.
 * @returns The message, or `''` when it can be deleted.
 */
export function memberLockMsg(id: string): string {
  const locks = memberLocks(id);
  if (locks.length === 0) return '';
  const many = locks.length > 1;
  return `Fiche protégée : la personne fait partie de ${many ? 'ces équipages' : 'l’équipage'} ${locks.join(', ')}. Retirez-la d’abord de ${many ? 'ces listes' : 'cette liste'}.`;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
