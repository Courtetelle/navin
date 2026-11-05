import type { FieldDefinition } from '../../../model/field.ts';
import type { Cruise } from '../../../model/types.ts';
import { navForDay } from '../../../state/index.ts';

/**
 * Computed fields of a section that print something: without its help text,
 * the navigation block of a day without journey is empty.
 * @param fields - Fields of the section.
 * @param cruise - Cruise printed.
 * @param dayId - Day key.
 * @returns The fields to print.
 */
export function printedCalcs(
  fields: readonly FieldDefinition[],
  cruise: Cruise,
  dayId: string,
): FieldDefinition[] {
  return fields.filter(
    (field) =>
      field.type === 'calc' &&
      (field.calc !== 'nav' || navForDay(dayId, cruise).legs.length > 0),
  );
}
