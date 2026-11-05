import type { ReactNode } from 'react';

import { useTr } from '../../../i18n/useTr.ts';
import type { FieldDefinition } from '../../../model/field.ts';

import { LabelCycle } from './LabelCycle.tsx';
import { useCompactForm } from './compactContext.ts';
import { isFilled } from './fieldChange.ts';

const SUBSCRIPTS = /(?<sub>ₘₐₓ|ₘᵢₙ)/;

/** Props of {@link FieldLabel}. */
export interface FieldLabelProps {
  field: FieldDefinition;
  /**
   * Target of the label.
   * @default the field's id
   */
  htmlFor?: string;
}

/**
 * Label of a cell: text, unit, computed rule, or the cycling title (legacy `lab`).
 * @param props - The field.
 * @returns The label, or nothing for a field without label.
 */
export function FieldLabel({ field, htmlFor }: FieldLabelProps) {
  const form = useCompactForm();
  const tr = useTr();
  const { key, label, labelCycle, unit, unitOnly, rule } = field;
  if (!label && !unitOnly && !labelCycle) return null;
  const id = htmlFor ?? form.ids.get(key);
  let title: ReactNode = null;
  if (labelCycle) title = <LabelCycle field={field} cycle={labelCycle} />;
  else if (label) title = labelParts(label, tr);
  return (
    <label htmlFor={id}>
      {title}
      {unit ? (
        <>
          {' '}
          <span className="u">{tr(`(${unit})`)}</span>
        </>
      ) : null}
      {rule ? (
        <small className="rule" hidden={isFilled(form.shown[key])}>
          {tr(rule(form.settings), { help: true })}
        </small>
      ) : null}
    </label>
  );
}

// Vₘₐₓ and x̄ keep their form in uppercase labels.
function labelParts(label: string, tr: (text: string) => string): ReactNode[] {
  const parts: ReactNode[] = [];
  for (const [index, part] of label.split(SUBSCRIPTS).entries()) {
    if (index % 2 === 1) {
      parts.push(
        <sub key={index} className="lab-nc">
          {part === 'ₘₐₓ' ? 'max' : 'min'}
        </sub>,
      );
    } else if (part.includes('x̄')) {
      const [before = '', after = ''] = part.split('x̄', 2);
      parts.push(
        before ? tr(before) : null,
        <span key={index} className="lab-nc">
          x̄
        </span>,
        after ? tr(after) : null,
      );
    } else if (part) {
      parts.push(tr(part));
    }
  }
  return parts;
}
