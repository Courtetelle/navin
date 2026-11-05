import type { MouseEvent } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import type { FieldDefinition } from '../../../model/field.ts';

import { Cell } from './Cell.tsx';
import { useCompactForm } from './compactContext.ts';

/**
 * A list of independent check buttons (legacy `check`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function CheckField({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const tr = useTr();
  const selected = (form.shown[field.key] ?? []) as readonly string[];
  const options = (field.options ?? []) as readonly string[];
  return (
    <Cell field={field} wide>
      <div className="checks" data-k={field.key} data-multi="1">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <Button
              key={option}
              className={on ? 'btn check on' : 'btn check'}
              data-opt={option}
              onClick={(event: MouseEvent) => {
                event.preventDefault();
                buzz();
                const current = (form.latest()[field.key] ??
                  []) as readonly string[];
                const next = new Set(current);
                if (!next.delete(option)) next.add(option);
                form.set(field.key, [...next]);
              }}
            >
              <span className="box">{on ? '✔' : ''}</span>
              {tr(option)}
            </Button>
          );
        })}
      </div>
    </Cell>
  );
}
