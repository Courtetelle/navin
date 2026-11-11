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

/** The ids of a form, kept while the form is on screen. */
interface DrawnForm {
  ids: FieldIds;
  /** The form left the screen: it draws again if it comes back. */
  released: boolean;
}

const drawnForms = new Map<string, DrawnForm>();
let drawnScreen = -1;

/**
 * Ids of a form, drawn once per form and per screen: React may start a render
 * again from scratch, losing the state of the form, and must not use more
 * random values than legacy.
 * @param screen - Id of the navigation that opened the screen.
 * @param formKey - Identity of the form on the screen.
 * @param fields - Fields, in drawing order.
 * @returns The drawn form.
 */
export function drawnForm(
  screen: number,
  formKey: string,
  fields: readonly FieldDefinition[],
): DrawnForm {
  if (screen !== drawnScreen) {
    drawnForms.clear();
    drawnScreen = screen;
  }
  let form = drawnForms.get(formKey);
  if (!form || form.released) {
    form = { ids: drawFieldIds(fields), released: false };
    drawnForms.set(formKey, form);
  }
  return form;
}

/**
 * Mark a form as on screen or gone.
 * @param form - Drawn form.
 * @param released - The form left the screen.
 */
export function markReleased(form: DrawnForm, released: boolean): void {
  form.released = released;
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
