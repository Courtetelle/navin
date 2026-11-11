import { useSignals } from '@preact/signals-react/runtime';
import { Fragment, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { setEntryValue } from '../../features/logbook/entryActions.ts';
import { buzz } from '../../lib/dom.ts';
import type { FieldDefinition } from '../../model/field.ts';
import { state } from '../../state/index.ts';

import { ChoiceEntry, MultiEntry } from './ChoiceEntry.tsx';
import { DateTimeEntry } from './DateTimeEntry.tsx';
import { NumberEntry } from './NumberEntry.tsx';
import { PositionEntry } from './PositionEntry.tsx';
import { TextEntry } from './TextEntry.tsx';

/** Props of {@link EntryField}. */
interface EntryFieldProps {
  field: FieldDefinition;
  /** Hidden by the propulsion state (no sails under engine). */
  hidden: boolean;
}

/**
 * One big card of the hourly form (legacy `renderField` and `bindField`): the
 * title, its « Effacer » button and the editor of the field type.
 * @param props - Field and visibility.
 * @returns The `section.field`.
 */
export function EntryField({ field, hidden }: EntryFieldProps) {
  useSignals();
  const { key, type, label } = field;
  const [typing, setTyping] = useState(false);
  const [textFilled, setTextFilled] = useState(() => filled(key));
  const [textGeneration, setTextGeneration] = useState(0);
  const has = type === 'text' ? textFilled : filled(key);
  return (
    <section
      className="field"
      data-key={key}
      hidden={hidden}
      onClick={(event) => {
        if (!typing && (event.target as Element).closest('button')) buzz();
      }}
    >
      <Fragment key={revision(key)}>
        <h2>
          <span>{label}</span>
          {has ? (
            <Button
              className="clear"
              data-act="clear"
              onClick={() => {
                if (typing) return;
                setEntryValue(key, null);
                setTextFilled(false);
                setTextGeneration((value) => value + 1);
              }}
            >
              Effacer
            </Button>
          ) : null}
        </h2>
        {type === 'datetime' ? <DateTimeEntry /> : null}
        {type === 'position' ? <PositionEntry field={field} /> : null}
        {type === 'number' ? (
          <NumberEntry field={field} typing={typing} onTyping={setTyping} />
        ) : null}
        {type === 'choice' || type === 'crew' ? (
          <ChoiceEntry field={field} />
        ) : null}
        {type === 'multi' ? <MultiEntry field={field} /> : null}
        {type === 'text' ? (
          <TextEntry key={textGeneration} field={field} />
        ) : null}
      </Fragment>
    </section>
  );
}

// Legacy redrew a card at each change: its buttons lose the focus and the
// hover, and the browser keeps the scroll position the same way.
function revision(key: string): string {
  const draft = state.data.draft.value;
  if (key === 't') return `${draft?.t}|${String(draft?.tManual)}`;
  if (key === 'note') return '';
  return JSON.stringify(draft?.v[key]) ?? '';
}

function filled(key: string): boolean {
  if (key === 't') return false;
  const value = state.data.draft.value?.v[key];
  if (value == null || value === '') return false;
  return !(Array.isArray(value) && value.length === 0);
}
