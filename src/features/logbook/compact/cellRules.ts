import type { FieldData, FieldDefinition } from '../../../model/field.ts';

/**
 * Whether a field's cell is hidden (legacy `applyGroups` and `applyElec`): the
 * propulsion rule wins over the group selector.
 * @param field - Field.
 * @param values - Current values.
 * @param groupValue - Value of the group selector around it.
 * @returns `true` when hidden.
 */
export function isCellHidden(
  field: FieldDefinition,
  values: FieldData,
  groupValue: string | undefined,
): boolean {
  if (field.elecOnly) return values.propType !== 'Électrique';
  if (field.gasOnly) return values.propType === 'Électrique';
  return (
    groupValue !== undefined && Boolean(field.when) && field.when !== groupValue
  );
}

/**
 * The cell takes the whole row (legacy `wide`).
 * @param field - Field.
 * @returns `true` when wide.
 */
export function isWide(field: FieldDefinition): boolean {
  if (field.wide) return true;
  return (
    ['area', 'check', 'tides', 'calc', 'choice', 'crewpick'].includes(
      field.type,
    ) && !field.cycle
  );
}
