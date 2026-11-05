import type { MouseEvent } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { textOf } from '../../../lib/format.ts';
import type { FieldDefinition, FieldOption } from '../../../model/field.ts';
import { crewNames, toast } from '../../../state/index.ts';

import { Cell } from './Cell.tsx';
import { FieldLabel } from './FieldLabel.tsx';
import { isWide } from './cellRules.ts';
import { useCompactForm } from './compactContext.ts';
import { cycleDisplay, cycleText, nextOption } from './fieldChange.ts';
import { useCellText } from './useCellText.ts';
import { useCycleAsk } from './useCycleAsk.ts';

/**
 * A choice among chips, a single cycling chip, or a plain input when the crew is
 * still empty (legacy `choice` and `crewpick`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function ChoiceField({ field }: { field: FieldDefinition }) {
  const options =
    field.type === 'crewpick'
      ? crewNames().map((name): FieldOption => [name])
      : ((field.options ?? []) as readonly FieldOption[]);
  if (options.length === 0) return <FreeChoice field={field} />;
  if (field.cycle) return <CycleChoice field={field} options={options} />;
  return <ChipsChoice field={field} options={options} />;
}

function FreeChoice({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const cell = useCellText(field);
  return (
    <Cell field={field} wide>
      <FieldLabel field={field} />
      <input
        className="text"
        id={form.ids.get(field.key)}
        data-k={field.key}
        type="text"
        value={cell.text}
        onChange={(event) => {
          const { value } = event.target;
          cell.setText(value);
          form.set(field.key, value.trim() === '' ? null : value);
        }}
        onFocus={cell.onFocus}
        onBlur={cell.onBlur}
      />
    </Cell>
  );
}

interface ChoiceProps {
  field: FieldDefinition;
  options: readonly FieldOption[];
}

function ChipsChoice({ field, options }: ChoiceProps) {
  const form = useCompactForm();
  const tr = useTr();
  const value = form.shown[field.key];
  return (
    <Cell field={field} wide={isWide(field)}>
      <FieldLabel field={field} />
      <div className="chips" data-k={field.key}>
        {options.map(([option, sub, third]) => (
          <Button
            key={option}
            choice
            className={value === option ? 'btn on' : 'btn'}
            data-opt={option}
            onClick={(event: MouseEvent) => {
              event.preventDefault();
              buzz();
              const same = form.latest()[field.key] === option;
              form.set(field.key, same ? null : option, true);
            }}
          >
            {tr(option)}
            {sub ? (
              <>
                {' '}
                <small>{tr(sub)}</small>
              </>
            ) : null}
            {third ? <small className="opt-h">{tr(third)}</small> : null}
          </Button>
        ))}
      </div>
    </Cell>
  );
}

function CycleChoice({ field, options }: ChoiceProps) {
  const form = useCompactForm();
  const tr = useTr();
  const { key, show, free, short } = field;
  const names = options.map(([option]) => option);
  const stored = () => textOf(form.latest()[key]);
  const shown = textOf(form.shown[key]);
  const display = (value: string) => cycleDisplay(show, value);
  const ask = useCycleAsk(({ confirm }) => {
    const value = nextOption(names, stored());
    buzz();
    form.set(key, value, true);
    confirm(1200);
    toast(`✓ Modifié : ${display(value)}`);
  });
  const classes = ['btn', 'cyc'];
  if (shown) classes.push('on');
  if (short) classes.push('cyc-short');
  if (ask.phase === 'asking') classes.push('cyc-ask');
  if (ask.phase === 'done') classes.push('lp-ok');
  let text = tr(cycleText(show, shown, names));
  if (ask.phase === 'asking') {
    text = tr(`Modifier pour ${display(nextOption(names, shown))} ?`);
  } else if (ask.phase === 'done') {
    text = `✓ ${display(shown)}`;
  }
  return (
    <Cell field={field} wide={isWide(field)}>
      <FieldLabel field={field} />
      <div className="chips" data-k={key}>
        <Button
          choice
          className={classes.join(' ')}
          data-free={free ? '1' : undefined}
          data-show={show ? JSON.stringify(show) : undefined}
          data-val={shown}
          data-cyc={names.join('|')}
          {...ask.pressHandlers}
          onContextMenu={(event: MouseEvent) => event.preventDefault()}
          onClick={(event: MouseEvent) => {
            event.preventDefault();
            buzz();
            if (ask.takeLongPress()) return;
            const value = nextOption(names, stored());
            if (stored() && !free) {
              ask.ask();
              toast(
                `Pour modifier pour « ${display(value)} » : appui long sur la pastille · sans appui long, « ${display(stored())} » reste`,
              );
              return;
            }
            form.set(key, value, true);
            ask.restore();
          }}
        >
          {text}
        </Button>
      </div>
    </Cell>
  );
}
