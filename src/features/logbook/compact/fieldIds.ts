import type { FieldDefinition } from '../../../model/field.ts';

/** Ids of the fields of a form (`key` → id of its input and label). */
export type FieldIds = ReadonlyMap<string, string>;

/**
 * A new element id for a field (legacy `compactField` first line).
 * @param key - Field key.
 * @returns `f_<key>_<4 random characters>`.
 */
export function newFieldId(key: string): string {
  return `f_${key}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Ids of a list of fields. Like legacy, every wrapping level of a field (`en`,
 * `addMore` / `reveal`, `labelCycle`) draws one: the random sequence, and so the
 * ids, stay those of legacy.
 * @param fields - Fields, in drawing order.
 * @returns Field key → id.
 */
export function drawFieldIds(fields: readonly FieldDefinition[]): FieldIds {
  const ids = new Map<string, string>();
  for (const field of fields) drawField(field, ids);
  return ids;
}

const screenIds = new Map<string, FieldIds>();
let idsScreen = -1;

/**
 * Ids of a form, drawn once per form and per screen: React may start a render
 * again from scratch, which must not use more random values than legacy.
 * @param screen - Id of the navigation that opened the screen.
 * @param place - Stable identity of the form on the screen (`useId`).
 * @param fields - Fields, in drawing order.
 * @returns Field key → id.
 */
export function screenFieldIds(
  screen: number,
  place: string,
  fields: readonly FieldDefinition[],
): FieldIds {
  if (screen !== idsScreen) {
    screenIds.clear();
    idsScreen = screen;
  }
  let ids = screenIds.get(place);
  if (!ids) {
    ids = drawFieldIds(fields);
    screenIds.set(place, ids);
  }
  return ids;
}

function drawField(field: FieldDefinition, ids: Map<string, string>): void {
  let id = newFieldId(field.key);
  if (field.en) id = newFieldId(field.key);
  if (field.addMore || field.reveal) id = newFieldId(field.key);
  if (field.labelCycle) id = newFieldId(field.key);
  ids.set(field.key, id);
  if (field.type === 'group') {
    for (const sub of field.fields ?? []) drawField(sub, ids);
  }
}
