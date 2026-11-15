import { uid } from '../../lib/format.ts';
import {
  DEP_CHECK,
  SAVANNAH_CHECK,
  SEA_DEP,
  SEA_QUIT,
} from '../../model/checklistSeeds.ts';
import type { ChecklistBase } from '../../model/logTypes.ts';
import type { Boat, ChecklistItem } from '../../model/types.ts';
import { state, updateCkLib } from '../../state/index.ts';

/** The subjects of the ready lists of check-in and check-out. */
export const PREP_SUBJECTS = [
  'Entraînement Savannah',
  'Location Savannah',
  'Invitation',
  'Bretagne nord 2027',
  'Rêves-sur-mer',
] as const;

/** Check-in (before leaving) or check-out (leaving the boat). */
export type PrepListKind = 'in' | 'out';

/** The subjects on the Savannah, the lake boat: its own lists. */
const ON_SAVANNAH = new Set<string>([
  'Entraînement Savannah',
  'Location Savannah',
  'Invitation',
]);

/**
 * The name of the ready list of a subject.
 * @param kind - Check-in or check-out.
 * @param subject - The subject.
 * @returns e.g. `Check-in · Location Savannah`.
 */
export function prepListName(kind: PrepListKind, subject: string): string {
  return `${kind === 'in' ? 'Check-in' : 'Check-out'} · ${subject}`;
}

function savannah(boats: readonly Boat[]): Boat | undefined {
  return boats.find((boat) => /savannah/iu.test(boat.info.boat ?? ''));
}

type BaseItem = Omit<ChecklistItem, 'id'>;

function copyItems(items: readonly ChecklistItem[] | undefined): BaseItem[] {
  return (items ?? [])
    .filter((item) => item.label)
    .map((item) => {
      const {
        id: _id,
        done: _done,
        ...kept
      } = item as ChecklistItem & {
        done?: unknown;
      };
      return kept;
    });
}

const fromLabels = (
  rows: ReadonlyArray<string | readonly [string, string]>,
): BaseItem[] =>
  rows.map((row) =>
    typeof row === 'string'
      ? { label: row }
      : { label: row[0], action: row[1] },
  );

/**
 * The lines a ready list starts with: those of the Savannah for its
 * subjects (its check-in, its « Quitter le bateau »), those of a sea
 * charter for the cruises.
 * @param kind - Check-in or check-out.
 * @param subject - The subject.
 * @param boats - The boats.
 * @returns The lines.
 */
export function prepListSeed(
  kind: PrepListKind,
  subject: string,
  boats: readonly Boat[],
): BaseItem[] {
  if (ON_SAVANNAH.has(subject)) {
    const boat = savannah(boats);
    if (kind === 'in') {
      const own = copyItems(boat?.checklistDep);
      return own.length > 0 ? own : fromLabels(DEP_CHECK);
    }
    const own = copyItems(boat?.checklist);
    return own.length > 0 ? own : fromLabels(SAVANNAH_CHECK);
  }
  return fromLabels(kind === 'in' ? SEA_DEP : SEA_QUIT);
}

/**
 * The ready list of a subject, made the first time from the lines of the
 * Savannah or of a sea charter; then the skipper's own, line by line.
 * @param kind - Check-in or check-out.
 * @param subject - The subject.
 * @returns The id of its base.
 */
export function prepListBase(kind: PrepListKind, subject: string): string {
  const name = prepListName(kind, subject);
  const kept = state.data.ckLib.value.find((base) => base.name === name);
  if (kept) return kept.id;
  const base: ChecklistBase = {
    id: uid(),
    name,
    cats: [kind === 'in' ? 'Check-in' : 'Check-out', subject],
    items: prepListSeed(kind, subject, state.data.boats.value),
    at: new Date().toISOString(),
  };
  updateCkLib((bases) => {
    bases.push(base);
  });
  return base.id;
}
