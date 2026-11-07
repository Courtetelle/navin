import { stringOf } from '../../../lib/format.ts';
import type {
  FieldData,
  FieldDefinition,
  SectionDefinition,
} from '../../../model/field.ts';
import { autoVal } from '../../../model/field.ts';
import type { Settings } from '../../../model/settings.ts';

/**
 * A value that counts as filled (legacy `v != null && v !== ''`).
 * @param value - Stored value.
 * @returns `true` when filled.
 */
export function isFilled(value: unknown): boolean {
  return value != null && value !== '';
}

/**
 * Whether a field shows something in a read-only view.
 * @param field - The field.
 * @param shown - The values shown.
 * @returns `true` when it holds a value.
 */
export function fieldHasValue(
  field: FieldDefinition,
  shown: Readonly<Record<string, unknown>>,
): boolean {
  if (field.fields) {
    return field.fields.some((sub) => fieldHasValue(sub, shown));
  }
  const value = shown[field.key];
  return field.type === 'check' ? Boolean(value) : isFilled(value);
}

/**
 * Next values of a form after one change (legacy `set` of `compactForm`): an
 * empty value is removed, a value equal to its computed one is removed too (the
 * field goes back to automatic), and the first filled field of a pair (m ⇄ ft)
 * is remembered as the base.
 * @param data - Current values.
 * @param key - Key changed.
 * @param value - New value.
 * @param fields - Every field of the form, groups flattened.
 * @param settings - User settings.
 * @returns New values; `data` is not changed.
 */
export function applyFieldChange(
  data: FieldData,
  key: string,
  value: unknown,
  fields: readonly FieldDefinition[],
  settings: Settings,
): FieldData {
  const next = { ...data };
  const empty =
    value == null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  if (empty) Reflect.deleteProperty(next, key);
  else next[key] = value;
  const auto = fields.find((field) => field.key === key && field.auto);
  if (!auto) return next;
  if (
    next[key] != null &&
    stringOf(next[key]) ===
      autoVal(auto, { ...next, [key]: undefined }, settings)
  ) {
    Reflect.deleteProperty(next, key);
  }
  if (auto.pair) {
    const source = `pairSrc_${[key, auto.pair].toSorted().join('_')}`;
    const own = isFilled(next[key]);
    const other = isFilled(next[auto.pair]);
    if (own && !other) next[source] = key;
    else if (!own && other) next[source] = auto.pair;
  }
  return next;
}

/** One child of a `.cgrid`. */
export type GridItem =
  | { kind: 'field'; field: FieldDefinition }
  | { kind: 'pair'; fields: readonly FieldDefinition[] }
  | { kind: 'frame'; frame: string; fields: readonly FieldDefinition[] };

/**
 * Children of a grid (legacy `cfFields`): a `pairNext` field shares a frame with
 * the next one, consecutive fields with the same `frame` share it too.
 * @param fields - Fields of the section.
 * @returns The grid items, in order.
 */
export function gridItems(fields: readonly FieldDefinition[]): GridItem[] {
  const items: GridItem[] = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index] as FieldDefinition;
    const next = fields[index + 1];
    if (field.pairNext && next) {
      items.push({ kind: 'pair', fields: [field, next] });
      index++;
    } else if (field.frame) {
      const framed: FieldDefinition[] = [];
      let last = index;
      while (fields[last]?.frame === field.frame) {
        framed.push(fields[last] as FieldDefinition);
        last++;
      }
      items.push({ kind: 'frame', frame: field.frame, fields: framed });
      index = last - 1;
    } else {
      items.push({ kind: 'field', field });
    }
  }
  return items;
}

/**
 * Sections drawn by a form: only the first one when flat.
 * @param sections - Sections.
 * @param flat - One grid without sections.
 * @returns The sections drawn.
 */
export function drawnSections<T extends Pick<SectionDefinition, 'fields'>>(
  sections: readonly T[],
  flat: boolean,
): readonly T[] {
  return flat ? sections.slice(0, 1) : sections;
}

/**
 * Text shown by a cycling chip (legacy `cycTxt`): the value, or its own display
 * (`< Bâbord`), else the choices.
 * @param show - Display of each stored value.
 * @param value - Stored value.
 * @param options - Choices.
 * @returns The chip text.
 */
export function cycleText(
  show: Readonly<Record<string, string>> | undefined,
  value: string,
  options: readonly string[],
): string {
  if (show && !value && show['']) return show[''];
  if (show) {
    if (value) return show[value] || value;
    const separator = Object.values(show).some((text) => /[<>]/.test(text))
      ? '  '
      : ' / ';
    return options.map((option) => show[option] || option).join(separator);
  }
  return value || options.join(' / ');
}

/**
 * Display of a choice inside messages, without its arrows (legacy `cycDisp`).
 * @param show - Display of each stored value.
 * @param value - Stored value.
 * @returns The text.
 */
export function cycleDisplay(
  show: Readonly<Record<string, string>> | undefined,
  value: string,
): string {
  return ((show ? show[value] : '') || value || '')
    .replaceAll(/[<>]/g, '')
    .trim();
}

/**
 * Next choice of a cycle.
 * @param options - Choices.
 * @param value - Current value.
 * @returns The value after it; the first one when the value is unknown.
 */
export function nextOption(options: readonly string[], value: string): string {
  const position = options.indexOf(value);
  return options[(position + 1) % options.length] as string;
}
