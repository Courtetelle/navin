import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { radioDesc } from '../../../lib/boatDescription.ts';
import { buzz } from '../../../lib/dom.ts';
import { stringOf } from '../../../lib/format.ts';
import type { FieldDefinition } from '../../../model/field.ts';

import { Cell } from './Cell.tsx';
import { FieldLabel } from './FieldLabel.tsx';
import { useCompactForm } from './compactContext.ts';
import { isFilled } from './fieldChange.ts';
import { useCellText } from './useCellText.ts';

/**
 * The radio description: a button that follows the data (a touch shows the
 * French version for 3 s) and a text area to force the text (legacy `descgen`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function DescGenField({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const tr = useTr();
  const cell = useCellText(field);
  const [french, setFrench] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const value = form.shown[field.key];
  const forced = isFilled(value);
  const describe = (language: 'en' | 'fr') =>
    (forced ? stringOf(value) : radioDesc(form.values, language, true)) || '…';
  const sayClasses = ['desc-say'];
  if (forced) sayClasses.push('auto-man');
  if (french) sayClasses.push('desc-fr');
  return (
    <Cell field={field} wide>
      <FieldLabel field={field} />
      <Button
        type="button"
        className={sayClasses.join(' ')}
        data-desc={field.key}
        onClick={(event: MouseEvent) => {
          event.preventDefault();
          buzz();
          clearTimeout(timer.current);
          setFrench(true);
          timer.current = setTimeout(() => setFrench(false), 3000);
        }}
      >
        {describe(french ? 'fr' : 'en')}
      </Button>
      <details className="desc-edit">
        <summary>{tr('✎ Forcer le texte (anglais)')}</summary>
        <textarea
          className={forced ? 'text auto-man' : 'text auto-calc'}
          id={form.ids.get(field.key)}
          data-k={field.key}
          rows={3}
          value={cell.text}
          onChange={(event) => {
            const text = event.target.value;
            cell.setText(text);
            form.set(field.key, text.trim() === '' ? null : text);
          }}
          onFocus={cell.onFocus}
          onBlur={cell.onBlur}
        />
      </details>
    </Cell>
  );
}
