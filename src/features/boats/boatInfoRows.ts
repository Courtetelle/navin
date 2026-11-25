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

const CE_LABEL = 'Catégorie de conception CE';
const CREW_MAX_LABEL = 'Nombre maximal de personnes à bord';

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
  return crewMaxUnderCe(out);
}

/**
 * The maximum number of people on board, shown just under the CE design
 * category it goes with (Corban, 25/11/2026).
 * @param sections - Sections of the sheet, changed in place.
 * @returns The same sections.
 */
function crewMaxUnderCe(sections: BoatInfoSection[]): BoatInfoSection[] {
  const ce = sections.find((section) =>
    section.rows.some(([label]) => label === CE_LABEL),
  );
  if (!ce) return sections;
  for (const section of sections) {
    const at = section.rows.findIndex(([label]) => label === CREW_MAX_LABEL);
    if (at === -1) continue;
    const [row] = section.rows.splice(at, 1);
    if (!row) continue;
    const ceAt = ce.rows.findIndex(([label]) => label === CE_LABEL);
    ce.rows.splice(ceAt + 1, 0, row);
    break;
  }
  return sections.filter((section) => section.rows.length > 0);
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
