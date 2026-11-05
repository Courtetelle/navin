import type { ChangeEvent, KeyboardEvent } from 'react';
import { useRef } from 'react';

import { useTr } from '../../../i18n/useTr.ts';
import type { FieldDefinition } from '../../../model/field.ts';

import { Cell } from './Cell.tsx';
import { FieldLabel } from './FieldLabel.tsx';
import { isWide } from './cellRules.ts';
import { useCompactForm } from './compactContext.ts';
import { useCellText } from './useCellText.ts';
import { fitTextarea, useFitTextarea } from './useFitTextarea.ts';

/**
 * A text area fitted to its text: `area`, or a `grow` line whose Enter key leaves
 * the field (legacy `area` and `line` with `grow`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function TextAreaField({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const tr = useTr();
  const area = useRef<HTMLTextAreaElement>(null);
  const cell = useCellText(field);
  useFitTextarea(area);
  const grow = field.type === 'line';
  const inputMode = field.inputmode as 'text' | undefined;
  return (
    <Cell field={field} wide={isWide(field)}>
      <FieldLabel field={field} />
      <textarea
        ref={area}
        className={grow ? 'text grow' : 'text fit'}
        id={form.ids.get(field.key)}
        data-k={field.key}
        rows={grow ? 1 : field.rows || 3}
        inputMode={grow ? inputMode : undefined}
        placeholder={tr.placeholder(field.placeholder ?? '')}
        value={cell.text}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          const { value } = event.target;
          cell.setText(value);
          form.set(field.key, value.trim() === '' ? null : value);
          fitTextarea(event.target);
        }}
        onFocus={cell.onFocus}
        onBlur={cell.onBlur}
        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === 'Enter' && grow) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </Cell>
  );
}
