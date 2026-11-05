import type { FieldDefinition } from '../model/field.ts';

import { stringOf } from './format.ts';
import { fmtPos } from './geo.ts';
import { windTxt } from './wind.ts';

/**
 * Number with the field's decimals and zero-padding (legacy `fmtNum`).
 * @param field - Field definition (`decimals`, `pad`).
 * @param value - Value.
 * @returns The French formatted number, or `''`.
 */
export function fmtNum(
  field: Pick<FieldDefinition, 'decimals' | 'pad'>,
  value: unknown,
): string {
  if (value == null || value === '') return '';
  const text = Number(value).toFixed(field.decimals).replace('.', ',');
  return field.pad ? text.padStart(field.pad, '0') : text;
}

/**
 * Display of a logbook value (legacy `fmtValue`).
 * @param field - Field definition.
 * @param value - Stored value.
 * @returns The text, `''` when empty.
 */
export function fmtValue(field: FieldDefinition, value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value) && value.length === 0) return '';
  if (field.type === 'number') {
    return field.wind
      ? windTxt(value)
      : `${fmtNum(field, value)} ${field.unit}`;
  }
  if (field.type === 'position') {
    return fmtPos(value as { lat: number; lon: number; text?: string });
  }
  if (field.type === 'multi') return (value as unknown[]).join(', ');
  if (field.type === 'choice' && field.fmt) return field.fmt(value as string);
  return stringOf(value);
}
