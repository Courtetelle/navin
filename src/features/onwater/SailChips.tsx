import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import { noteLakeEvent } from './lakeActions.ts';
import type { LakeState } from './lakeState.ts';
import { useBoxTr } from './useBoxTr.ts';

/** Props of {@link SailChips}. */
interface SailChipsProps {
  field: 'allure' | 'gv' | 'avant';
  options: readonly string[];
  /** Columns of the row. */
  columns: number;
  current: LakeState;
  /** Key of the button waiting for its entry. */
  pending: string | null;
  /** Receives the key of the button touched. */
  onPick: (key: string) => void;
  /** Shown outside `#view`. */
  inPopup: boolean;
}

/**
 * Point of sail or sail choice, noted in the journal at each change.
 * @param props - Field, options and state.
 * @returns The row.
 */
export function SailChips({
  field,
  options,
  columns,
  current,
  pending,
  onPick,
  inPopup,
}: SailChipsProps) {
  const tr = useBoxTr(inPopup);
  const pick = (value: string) => {
    if (current[field] === value) {
      buzz();
      toast('Déjà noté');
      return;
    }
    onPick(`${field}|${value}`);
    if (field === 'allure') {
      noteLakeEvent(
        { evt: ['Changement d’allure'], allure: value },
        `⛵ Allure : ${value}`,
      );
      return;
    }
    noteLakeEvent(
      {
        evt: ['Changement de voile'],
        gv: field === 'gv' ? value : current.gv || undefined,
        avant: field === 'avant' ? value : current.avant || undefined,
      },
      `⛵ ${field === 'gv' ? 'Grand-voile' : 'Voile d’avant'} : ${value}`,
    );
  };
  return (
    <ButtonRow className={`row nav-chips c${columns}`}>
      {options.map((option) => (
        <Button
          key={option}
          className={option === current[field] ? 'btn on' : 'btn'}
          data-set={field}
          data-val={option}
          disabled={pending === `${field}|${option}`}
          onClick={() => pick(option)}
        >
          {tr(option)}
        </Button>
      ))}
    </ButtonRow>
  );
}
