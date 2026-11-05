import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { setEntryValue } from '../../features/logbook/entryActions.ts';
import type { FieldDefinition, FieldOption } from '../../model/field.ts';
import { crewNames, state } from '../../state/index.ts';

/**
 * Choice among big buttons, also for the officer of the watch (legacy `choice`
 * and `crew`): a second touch on the chosen button clears it.
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The row of buttons.
 */
export function ChoiceEntry({ field }: { field: FieldDefinition }) {
  useSignals();
  const crew = field.type === 'crew';
  const options = crew
    ? crewNames().map((name): FieldOption => [name])
    : ((field.options ?? []) as readonly FieldOption[]);
  const value = state.data.draft.value?.v[field.key];
  return (
    <div className={`row c${crew ? 2 : field.cols}`}>
      {options.map(([option, sub, third]) => (
        <Button
          key={option}
          className={value === option ? 'btn on' : 'btn'}
          data-opt={option}
          onClick={() =>
            setEntryValue(field.key, value === option ? null : option)
          }
        >
          {option}
          {sub ? <small>{sub}</small> : null}
          {third ? <small className="opt-h">{third}</small> : null}
        </Button>
      ))}
    </div>
  );
}

/**
 * Several choices among big buttons (legacy `multi`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The row of buttons.
 */
export function MultiEntry({ field }: { field: FieldDefinition }) {
  useSignals();
  const selected = (state.data.draft.value?.v[field.key] ??
    []) as readonly string[];
  const options = (field.options ?? []) as readonly FieldOption[];
  return (
    <div className={`row c${field.cols}`}>
      {options.map(([option]) => (
        <Button
          key={option}
          className={selected.includes(option) ? 'btn on' : 'btn'}
          data-opt={option}
          onClick={() => {
            const next = new Set(selected);
            if (!next.delete(option)) next.add(option);
            setEntryValue(field.key, [...next]);
          }}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
