import type { MouseEvent } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { textOf } from '../../../lib/format.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import { toast } from '../../../state/index.ts';

import { useCompactForm } from './compactContext.ts';
import { useCycleAsk } from './useCycleAsk.ts';

/** Props of {@link LabelCycle}. */
interface LabelCycleProps {
  field: FieldDefinition;
  cycle: NonNullable<FieldDefinition['labelCycle']>;
}

/**
 * Title that changes the kind of a value (passport ⇄ identity card). Once a
 * choice or a number is there, a tap only asks and a long press confirms.
 * @param props - Field and cycle definition.
 * @returns The `button.lab-cyc`.
 */
export function LabelCycle({ field, cycle }: LabelCycleProps) {
  const form = useCompactForm();
  const tr = useTr();
  const { key, options, prefix = '', suffix = '' } = cycle;
  const first = options[0] as string;
  const wording = (value: string) => `${prefix}${value}${suffix}`;
  const stored = () => textOf(form.latest()[key]);
  const next = () => {
    const position = Math.max(0, options.indexOf(stored() || first));
    return options[(position + 1) % options.length] as string;
  };
  const ask = useCycleAsk(({ restore }) => {
    const value = next();
    buzz();
    form.set(key, value);
    restore();
    toast(`✓ Modifié : ${wording(value)}`);
  });
  const current = textOf(form.shown[key]) || first;
  return (
    <Button
      type="button"
      className={ask.phase === 'asking' ? 'lab-cyc cyc-ask' : 'lab-cyc'}
      data-val={current}
      {...ask.pressHandlers}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        if (ask.takeLongPress()) return;
        buzz();
        const value = next();
        if (stored() || form.latest()[field.key]) {
          ask.ask();
          toast(
            `Pour modifier pour « ${wording(value)} » : appui long sur l’intitulé · sans appui long, « ${wording(stored() || first)} » reste`,
          );
          return;
        }
        form.set(key, value);
        ask.restore();
      }}
    >
      {ask.phase === 'asking'
        ? tr(`Modifier pour ${wording(next())} ?`)
        : tr(wording(current))}
    </Button>
  );
}
