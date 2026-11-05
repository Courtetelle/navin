import type { FieldLayout } from './fieldLayout.ts';
import type { Settings } from './settings.ts';

/** Input kinds of the logbook form, the day sheet, the boat and crew sheets. */
export type FieldType =
  | 'datetime'
  | 'crew'
  | 'number'
  | 'position'
  | 'choice'
  | 'multi'
  | 'text'
  | 'num'
  | 'line'
  | 'area'
  | 'date'
  | 'clock'
  | 'calc'
  | 'check'
  | 'tides'
  | 'crewpick'
  | 'signature'
  | 'sails'
  | 'descgen'
  | 'group';

/** Identifier of a computed block, rendered by the logbook domain. */
export type CalcKind = 'engine' | 'nav' | 'miles' | 'lake';

/** Loose record of field values (day sheet, cruise info, member card). */
export type FieldData = Record<string, unknown>;

/** Choice option `[value, sub-label?, third column?]` (same as `ChoiceOption`). */
export type FieldOption = readonly [string, string?, string?];

/**
 * One field definition. Legacy definitions are plain objects with optional
 * flags; the same shape is kept so that ported renderers can follow the
 * legacy code line by line.
 */
export interface FieldDefinition extends FieldLayout {
  key: string;
  type: FieldType;
  /**
   * Label (absent for calc blocks).
   * @default undefined
   */
  label?: string;
  /**
   * Label used on lake outings.
   * @default undefined
   */
  lakeLabel?: string;
  /**
   * Unit shown after the label.
   * @default undefined
   */
  unit?: string;
  /**
   * Sea only (hidden on lake outings).
   * @default false
   */
  sea?: boolean;
  /**
   * Lake only (hidden at sea).
   * @default false
   */
  lake?: boolean;
  /**
   * Wind speed in knots (Beaufort and km/h shown).
   * @default false
   */
  wind?: boolean;
  /**
   * Step buttons of a number field.
   * @default undefined
   */
  steps?: readonly number[];
  /** @default undefined */
  min?: number;
  /** @default undefined */
  max?: number;
  /**
   * Wraps around at `max` (directions).
   * @default false
   */
  wrap?: boolean;
  /** @default undefined */
  decimals?: number;
  /**
   * Start value of a number field.
   * @default undefined
   */
  start?: number;
  /**
   * Zero-padding width of the formatted number.
   * @default undefined
   */
  pad?: number;
  /**
   * Choices (`check` fields use plain strings).
   * @default undefined
   */
  options?: readonly FieldOption[] | readonly string[];
  /**
   * Display of a stored choice.
   * @default undefined
   */
  fmt?: (value: string) => string;
  /**
   * Critical value: protected against accidental edits.
   * @default false
   */
  lock?: boolean;
  /**
   * Computed value shown while the field is empty.
   * @default undefined
   */
  auto?: (data: FieldData, settings: Settings) => string;
  /**
   * Explanation of the computed value.
   * @default undefined
   */
  rule?: (settings: Settings) => string;
  /**
   * The value was typed by hand (shown in red).
   * @default undefined
   */
  manual?: (data: FieldData) => boolean;
  /**
   * Key of the paired field (m ⇄ ft, kW ⇄ ch).
   * @default undefined
   */
  pair?: string;
  /**
   * Group field: value of `sel` that shows this sub-field.
   * @default undefined
   */
  when?: string;
  /**
   * Group field: key of the selector.
   * @default undefined
   */
  sel?: string;
  /**
   * Group field: sub-fields.
   * @default undefined
   */
  fields?: readonly FieldDefinition[];
  /**
   * Computed block identifier.
   * @default undefined
   */
  calc?: CalcKind;
}

/** A titled group of fields. */
export interface SectionDefinition {
  title: string;
  fields: readonly FieldDefinition[];
  /**
   * Sea only.
   * @default false
   */
  sea?: boolean;
  /**
   * Lake only.
   * @default false
   */
  lake?: boolean;
  /**
   * Starts folded.
   * @default false
   */
  collapsed?: boolean;
}

/**
 * Shorthand of a numeric text field (legacy `n`).
 * @param key - Field key.
 * @param label - Label.
 * @param unit - Unit.
 * @param extra - Other properties.
 * @returns The field definition.
 */
export function numField(
  key: string,
  label: string,
  unit: string,
  extra: Partial<FieldDefinition> = {},
): FieldDefinition {
  return { key, label, type: 'num', unit, ...extra };
}

/**
 * Computed value of a field (legacy `autoVal`).
 * @param field - Field definition.
 * @param data - Current values.
 * @param settings - User settings (margins and rounding steps).
 * @returns The computed text, or `''`.
 */
export function autoVal(
  field: FieldDefinition,
  data: FieldData | null | undefined,
  settings: Settings,
): string {
  return field.auto ? field.auto(data ?? {}, settings) : '';
}

/**
 * Flatten group fields into the list (legacy `flatFields`).
 * @param fields - Field list.
 * @returns Every field, groups followed by their sub-fields.
 */
export function flatFields(
  fields: readonly FieldDefinition[],
): FieldDefinition[] {
  const out: FieldDefinition[] = [];
  for (const field of fields) {
    out.push(field);
    if (field.type === 'group' && field.fields) out.push(...field.fields);
  }
  return out;
}
