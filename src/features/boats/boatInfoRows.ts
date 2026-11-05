import { boatSections } from '../../model/boatSheet.ts';
import type { FieldDefinition } from '../../model/field.ts';
import { autoVal, flatFields } from '../../model/field.ts';
import type { Boat } from '../../model/types.ts';
import { state } from '../../state/index.ts';

/** One line of a boat sheet: label and value. */
export type BoatInfoRow = [label: string, value: string];

/** A titled block of a boat sheet. */
export interface BoatInfoSection {
  title: string;
  rows: BoatInfoRow[];
}

const NO_VALUE_TYPES = new Set(['signature', 'check', 'tides', 'calc']);

/**
 * The filled values of a boat sheet, for print and images (legacy `boatInfoRows`).
 * @param boat - Boat.
 * @returns Its sections with a value.
 */
export function boatInfoRows(boat: Boat): BoatInfoSection[] {
  const settings = state.preferences.settings.value;
  const out: BoatInfoSection[] = [];
  const valueOf = (field: FieldDefinition): unknown => {
    const value = boat.info[field.key];
    return value != null && value !== ''
      ? value
      : autoVal(field, boat.info, settings);
  };
  for (const section of boatSections(boat)) {
    if (section.title === 'Numéros utiles (page SOS)') continue;
    const groupLabels: Record<string, string> = {};
    for (const group of section.fields) {
      if (group.type !== 'group') continue;
      for (const field of group.fields ?? []) {
        if (!field.label) groupLabels[field.key] = group.label ?? '';
      }
    }
    const rows: BoatInfoRow[] = [];
    const propulsion = boat.info.propType || 'Gasoil';
    for (const field of flatFields(section.fields)) {
      if (field.type === 'group') continue;
      if (field.when && field.when !== propulsion) continue;
      const value = valueOf(field);
      if (value == null || value === '') continue;
      if (NO_VALUE_TYPES.has(field.type)) continue;
      const label =
        field.key === 'contacts'
          ? 'Numéros'
          : field.label || groupLabels[field.key] || field.key;
      rows.push([label, valueText(field, value)]);
    }
    if (rows.length > 0) out.push({ title: section.title, rows });
  }
  return out;
}

function valueText(field: FieldDefinition, value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  const plain = String(value);
  const shown = field.show?.[plain];
  const text = shown && !/[<>]/.test(shown) ? shown : plain;
  const unit =
    field.unit && field.type === 'num' && /^[\d.,\s-]+$/.test(plain)
      ? ` ${field.unit}`
      : '';
  return `${field.prefix ? `${field.prefix} ` : ''}${text}${unit}`;
}
