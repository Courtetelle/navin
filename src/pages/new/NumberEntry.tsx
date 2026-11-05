import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import { setEntryValue } from '../../features/logbook/entryActions.ts';
import { fmtNum } from '../../lib/fieldFormat.ts';
import { num } from '../../lib/format.ts';
import { windConv } from '../../lib/wind.ts';
import type { FieldDefinition } from '../../model/field.ts';
import { DIRS8 } from '../../model/lists.ts';
import { state, toast } from '../../state/index.ts';

import { stepValue } from './stepValue.ts';

/** Props of {@link NumberEntry}. */
export interface NumberEntryProps {
  field: FieldDefinition;
  /** The keyboard input is shown: the other buttons of the card do nothing. */
  typing: boolean;
  onTyping: (typing: boolean) => void;
}

/**
 * Number editor: a tap on the value opens the keyboard, steps and compass rose
 * work without it (legacy `number`).
 * @param props - Field and keyboard state.
 * @returns The editor.
 */
export function NumberEntry({ field, typing, onTyping }: NumberEntryProps) {
  useSignals();
  const { key, unit, wind, rose, start, steps = [] } = field;
  const value = state.data.draft.value?.v[key];
  const has = value != null && value !== '';
  return (
    <>
      {typing ? (
        <NumberInput field={field} onDone={() => onTyping(false)} />
      ) : (
        <Button
          className={has ? 'value' : 'value empty'}
          data-act="type"
          onClick={() => onTyping(true)}
        >
          {has ? (
            <>
              {fmtNum(field, value)} <span className="unit">{unit}</span>
              {wind ? <span className="hint">{windConv(value)}</span> : null}
            </>
          ) : (
            <>
              – –<span className="hint">toucher ici pour taper</span>
            </>
          )}
        </Button>
      )}
      {rose ? (
        <div className="row c4">
          {DIRS8.map(([direction, angle]) => (
            <Button
              key={direction}
              className={value === angle ? 'btn on' : 'btn'}
              data-set={angle}
              onClick={() => {
                if (!typing) setEntryValue(key, angle);
              }}
            >
              {direction}
            </Button>
          ))}
        </div>
      ) : null}
      <ButtonRow className="row c4">
        {steps.map((step) => (
          <Button
            key={step}
            className="btn step"
            data-step={step}
            onClick={() => {
              if (typing) return;
              const current = state.data.draft.value?.v[key] ?? start;
              setEntryValue(key, stepValue(field, current, step));
            }}
          >
            {step > 0 ? '+' : '−'}
            {String(Math.abs(step)).replace('.', ',')}
          </Button>
        ))}
      </ButtonRow>
    </>
  );
}

function NumberInput({
  field,
  onDone,
}: {
  field: FieldDefinition;
  onDone: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useMarquee(input);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const value = state.data.draft.peek()?.v[field.key];
  const { key, min = 0, max = 0, decimals = 0, label } = field;
  const commit = () => {
    const text = input.current?.value ?? '';
    if (text.trim() === '') {
      setEntryValue(key, null);
      onDone();
      return;
    }
    const typed = num(text);
    if (typed == null || typed < min || typed > max) {
      toast(`Valeur entre ${min} et ${max}`);
      return;
    }
    setEntryValue(key, Math.round(typed * 10 ** decimals) / 10 ** decimals);
    onDone();
  };
  return (
    <div
      className="row"
      style={{ marginBottom: '12px', gridTemplateColumns: '2fr 1fr' }}
    >
      <input
        ref={input}
        className="text"
        type="text"
        inputMode="decimal"
        style={{ fontSize: '34px', textAlign: 'center' }}
        defaultValue={value == null ? '' : fmtNum(field, value)}
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      <Button className="btn primary" data-act="ok" onClick={commit}>
        OK
      </Button>
    </div>
  );
}
