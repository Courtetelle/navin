import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { radioDesc } from '../../../lib/boatDescription.ts';
import { buzz } from '../../../lib/dom.ts';
import { stringOf } from '../../../lib/format.ts';
import { createTimerGroup } from '../../../lib/timers.ts';
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
  const { key } = field;
  const readLatest = form.latest;
  const [french, setFrench] = useState(false);
  // The button follows what is typed in the form, not the choices touched.
  const [described, setDescribed] = useState(form.values);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const refreshes = createTimerGroup();
    const onInput = () => {
      refreshes.after(0, () => setDescribed(readLatest()));
    };
    document.addEventListener('input', onInput);
    return () => {
      refreshes.clear();
      clearTimeout(timer.current);
      document.removeEventListener('input', onInput);
    };
  }, [readLatest]);
  const say = described[key];
  const sayClasses = ['desc-say'];
  if (isFilled(say)) sayClasses.push('auto-man');
  if (french) sayClasses.push('desc-fr');
  const text =
    (isFilled(say)
      ? stringOf(say)
      : radioDesc(described, french ? 'fr' : 'en', true)) || '…';
  return (
    <Cell field={field} wide>
      <FieldLabel field={field} />
      <Button
        type="button"
        className={sayClasses.join(' ')}
        data-desc={key}
        onClick={(event: MouseEvent) => {
          event.preventDefault();
          buzz();
          clearTimeout(timer.current);
          setDescribed(readLatest());
          setFrench(true);
          timer.current = setTimeout(() => {
            setFrench(false);
            setDescribed(readLatest());
          }, 3000);
        }}
      >
        {text}
      </Button>
      <details className="desc-edit">
        <summary>{tr('✎ Forcer le texte (anglais)')}</summary>
        <textarea
          className={
            isFilled(form.shown[key]) ? 'text auto-man' : 'text auto-calc'
          }
          id={form.ids.get(key)}
          data-k={key}
          rows={3}
          value={cell.text}
          onChange={(event) => {
            const { value } = event.target;
            cell.setText(value);
            form.set(key, value.trim() === '' ? null : value);
          }}
          onFocus={cell.onFocus}
          onBlur={cell.onBlur}
        />
      </details>
    </Cell>
  );
}
