import type { ReactNode } from 'react';

import { stringOf } from '../../../lib/format.ts';
import { knOk, windTxt } from '../../../lib/wind.ts';
import type { FieldData, FieldDefinition } from '../../../model/field.ts';
import { flatFields } from '../../../model/field.ts';
import { dayVal } from '../csv.ts';

const NOT_PRINTED: ReadonlySet<string> = new Set([
  'group',
  'calc',
  'tides',
  'signature',
]);

/**
 * Rows `label / value` of a printed page (legacy `kv` of `printBook`): every
 * field that has a value, wind in knots and Beaufort.
 * @param fields - Fields to print.
 * @param data - Values.
 * @returns One `<tr>` per field with a value.
 */
export function kvRows(
  fields: readonly FieldDefinition[],
  data: FieldData,
): ReactNode[] {
  const rows: ReactNode[] = [];
  for (const field of flatFields(fields)) {
    if (NOT_PRINTED.has(field.type)) continue;
    const stored = data[field.key];
    const value =
      field.wind && knOk(stored) ? windTxt(stored) : dayVal(field, stored);
    if (value === '') continue;
    rows.push(
      <tr key={field.key}>
        <th>{field.label || (field.unitOnly ? 'Puissance' : '')}</th>
        <td>{stringOf(value)}</td>
      </tr>,
    );
  }
  return rows;
}
