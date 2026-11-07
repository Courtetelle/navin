import type { ChangeEvent } from 'react';
import { useEffect, useRef } from 'react';

import { useMarquee } from '../../../components/shared/useMarquee.ts';
import { useTr } from '../../../i18n/useTr.ts';
import { textOf } from '../../../lib/format.ts';
import { createTimerGroup } from '../../../lib/timers.ts';
import { windConv } from '../../../lib/wind.ts';
import type { FieldDefinition } from '../../../model/field.ts';

import { Cell } from './Cell.tsx';
import { FieldLabel } from './FieldLabel.tsx';
import { isWide } from './cellRules.ts';
import type { CompactFormContext } from './compactContext.ts';
import { useCompactForm } from './compactContext.ts';
import { expNote, expState } from './expiry.ts';
import { isFilled } from './fieldChange.ts';
import { useCellText } from './useCellText.ts';
import { useFieldLock } from './useFieldLock.ts';

const INPUT_TYPES: Partial<Record<FieldDefinition['type'], string>> = {
  date: 'date',
  clock: 'time',
};

/**
 * A one-line input: text, number, date or time (legacy `line`, `num`, `date`,
 * `clock`), with its computed value, protection, expiry and wind conversion.
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function LineField({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  const cell = useCellText(field);
  const lock = useFieldLock(field, cell.text, cell.focused, input);
  useMarquee(input);
  useDependentPicker(field, input);
  const { key, type, prefix, expiry, wind, minFrom } = field;
  const { inputmode, placeholder = '' } = field;
  const formStore = form.store;
  useEffect(() => {
    formStore.register(key, input.current);
    return () => formStore.register(key, null);
  }, [formStore, key]);

  const expired = expiry ? expState(cell.text) : '';
  const classes = lineClasses(field, form, expired, lock.classes);
  const inputMode = type === 'num' ? 'decimal' : inputmode;
  const minimum = minFrom ? textOf(form.values[minFrom]) : '';

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    cell.setText(value);
    form.set(key, value.trim() === '' ? null : value);
    for (const other of form.fields) {
      if (other.minFrom !== key || !value) continue;
      const after = textOf(form.latest()[other.key]);
      if (!after || after < value) form.set(other.key, value);
    }
  };
  const element = (
    <input
      ref={input}
      className={classes.join(' ')}
      id={form.ids.get(key)}
      data-k={key}
      type={INPUT_TYPES[type] ?? 'text'}
      min={minimum || undefined}
      inputMode={inputMode as 'text' | undefined}
      placeholder={tr.placeholder(placeholder)}
      value={cell.text}
      readOnly={lock.readOnly || form.filledOnly}
      onChange={onChange}
      onFocus={cell.onFocus}
      onBlur={() => {
        cell.onBlur();
        lock.onBlur();
      }}
      {...lock.handlers}
    />
  );
  return (
    <Cell field={field} wide={isWide(field)}>
      <FieldLabel field={field} />
      {prefix ? (
        <div className="pfx-wrap">
          <span className="pfx" aria-hidden="true">
            {prefix}
          </span>
          {element}
        </div>
      ) : (
        element
      )}
      {expiry ? (
        <small className="exp-note">
          {tr(expNote(expired), { help: true })}
        </small>
      ) : null}
      {wind ? <small className="conv">{windConv(cell.text)}</small> : null}
    </Cell>
  );
}

function lineClasses(
  { key, auto, manual }: FieldDefinition,
  form: CompactFormContext,
  expired: string,
  lockClasses: readonly string[],
): string[] {
  const stored = isFilled(form.shown[key]);
  const classes = ['text'];
  if (auto) {
    if (manual ? manual(form.values) : stored) classes.push('auto-man');
    if (!stored) classes.push('auto-calc');
  }
  classes.push(...lockClasses);
  if (expired === 'warn') classes.push('exp-warn');
  if (expired === 'bad') classes.push('exp-bad');
  return classes;
}

// An end date opens right after its start date was chosen.
function useDependentPicker(
  field: FieldDefinition,
  input: React.RefObject<HTMLInputElement | null>,
): void {
  const form = useCompactForm();
  const dependent = form.fields.find((other) => other.minFrom === field.key);
  useEffect(() => {
    const element = input.current;
    if (!element || !dependent) return undefined;
    const timers = createTimerGroup();
    const onNativeChange = () => {
      if (!element.value) return;
      timers.after(300, () => {
        const target = document.querySelector<HTMLInputElement>(
          `[data-k="${CSS.escape(dependent.key)}"]`,
        );
        try {
          target?.focus();
          target?.showPicker();
        } catch {
          target?.focus();
        }
      });
    };
    element.addEventListener('change', onNativeChange);
    return () => {
      timers.clear();
      element.removeEventListener('change', onNativeChange);
    };
  }, [dependent, input]);
}
