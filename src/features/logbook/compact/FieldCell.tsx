import type { ComponentType } from 'react';

import { textOf } from '../../../lib/format.ts';
import type {
  FieldDefinition,
  FieldOption,
  FieldType,
} from '../../../model/field.ts';
import { CalcBlock } from '../calc/CalcBlock.tsx';

import { Cell } from './Cell.tsx';
import { CheckField } from './CheckField.tsx';
import { ChoiceField } from './ChoiceField.tsx';
import { DescGenField } from './DescGenField.tsx';
import { FieldLabel } from './FieldLabel.tsx';
import { LineField } from './LineField.tsx';
import { SailsField } from './SailsField.tsx';
import { SignatureField } from './SignatureField.tsx';
import { TextAreaField } from './TextAreaField.tsx';
import { TidesField } from './TidesField.tsx';
import { GroupValueContext, useCompactForm } from './compactContext.ts';

const CELLS: Partial<Record<FieldType, ComponentType<FieldProps>>> = {
  group: GroupField,
  sails: SailsField,
  date: LineField,
  clock: LineField,
  num: LineField,
  descgen: DescGenField,
  area: TextAreaField,
  choice: ChoiceField,
  crewpick: ChoiceField,
  check: CheckField,
  tides: TidesField,
  signature: SignatureField,
  calc: CalcField,
};

interface FieldProps {
  field: FieldDefinition;
}

/**
 * One field of a compact form (legacy `compactField`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns Its cell.
 */
export function FieldCell({ field }: FieldProps) {
  if (field.type === 'line') {
    return field.grow ? (
      <TextAreaField field={field} />
    ) : (
      <LineField field={field} />
    );
  }
  const Component = CELLS[field.type];
  return Component ? <Component field={field} /> : null;
}

function CalcField({ field }: FieldProps) {
  return (
    <Cell field={field} wide className="calc" data-calc={field.key}>
      <CalcBlock field={field} />
    </Cell>
  );
}

function GroupField({ field }: FieldProps) {
  const form = useCompactForm();
  const subFields = field.fields ?? [];
  const selector = subFields[0]?.options as readonly FieldOption[] | undefined;
  const current =
    textOf(form.shown[field.sel ?? '']) || (selector?.[0]?.[0] ?? '');
  return (
    <Cell field={field} wide className="cf-group" data-grp={field.sel}>
      <FieldLabel field={field} />
      <div className="grp-in">
        <GroupValueContext value={current}>
          {subFields.map((sub) => (
            <FieldCell key={sub.key} field={sub} />
          ))}
        </GroupValueContext>
      </div>
    </Cell>
  );
}
