import { choiceIn, currentIn, persist, update } from './listPublishState.ts';
import type { ListChoice, ListKind } from './types.ts';

/**
 * Keep a single element checked (the Publier button of a sheet).
 * @param kind - List kind.
 * @param others - Ids of all the other elements.
 */
export function keepOnly(kind: ListKind, others: readonly string[]): void {
  update((draft) => {
    choiceIn(draft, kind).off = [...others];
  });
}

/**
 * Check or uncheck one element.
 * @param kind - List kind.
 * @param id - Element id.
 */
export function toggleItem(kind: ListKind, id: string): void {
  update((draft) => {
    const choice = choiceIn(draft, kind);
    choice.off = toggled(choice.off, id);
  });
}

/**
 * Master box of the elements: check all, or uncheck all when all were checked.
 * @param kind - List kind.
 * @param ids - All element ids.
 */
export function toggleAllItems(kind: ListKind, ids: readonly string[]): void {
  update((draft) => {
    const choice = choiceIn(draft, kind);
    choice.off = choice.off.length > 0 ? [] : [...ids];
  });
}

/**
 * Switch a section on or off (also `§photos` and `§face`), saved in the template.
 * @param kind - List kind.
 * @param key - Section key.
 */
export function toggleSection(kind: ListKind, key: string): void {
  saved(kind, (choice) => {
    choice.offSec = toggled(choice.offSec, key);
  });
}

/**
 * Master box of the sections: all on when one is off, else all off.
 * @param kind - List kind.
 * @param keys - All section keys.
 */
export function toggleAllSections(
  kind: ListKind,
  keys: readonly string[],
): void {
  saved(kind, (choice) => {
    const anyOff = keys.some((key) => choice.offSec.includes(key));
    choice.offSec = anyOff
      ? choice.offSec.filter((key) => !keys.includes(key))
      : [...choice.offSec, ...keys];
  });
}

/**
 * Switch one row of a section on or off.
 * @param kind - List kind.
 * @param id - `section|label`.
 */
export function toggleRow(kind: ListKind, id: string): void {
  saved(kind, (choice) => {
    choice.offRow = toggled(choice.offRow, id);
  });
}

/**
 * Switch one photo on or off.
 * @param kind - List kind.
 * @param id - Photo id.
 */
export function togglePhoto(kind: ListKind, id: string): void {
  saved(kind, (choice) => {
    choice.offPh = toggled(choice.offPh, id);
  });
}

function saved(kind: ListKind, change: (choice: ListChoice) => void): void {
  update((draft) => {
    const choice = choiceIn(draft, kind);
    change(choice);
    const current = currentIn(draft, kind);
    current.offSec = [...choice.offSec];
    current.offRow = [...choice.offRow];
    current.offPh = [...choice.offPh];
  });
  persist();
}

function toggled(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
