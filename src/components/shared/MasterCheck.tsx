import type { MouseEvent } from 'react';

import { useTr } from '../../i18n/useTr.ts';

import { Button } from './Button.tsx';
import { masterState } from './masterState.ts';

/** Props of {@link MasterCheck}. */
export interface MasterCheckProps {
  /** Number of items checked. */
  checked: number;
  /** Number of items. */
  total: number;
  /** Data attribute set to `"1"` (legacy third argument, e.g. `data-ckall`). */
  attribute: `data-${string}`;
  /** Tap: check all, or uncheck all when all were checked. */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Master checkbox at the top of a checklist (legacy `window.masterCheck`,
 * nav.js:3-6): ✔ all checked, – some, empty none; `Tout` and `n / total`.
 * @param props - Counts, data attribute and action.
 * @returns The `button.btn.check.ck-master`.
 */
export function MasterCheck({
  checked,
  total,
  attribute,
  onClick,
}: MasterCheckProps) {
  const tr = useTr();
  const state = masterState(checked, total);
  const data = { [attribute]: '1' };
  return (
    <Button
      type="button"
      className={`btn check ck-master ${state}`}
      {...data}
      onClick={onClick}
    >
      <span className="box">
        {state === 'on' ? '✔' : state === 'part' ? '–' : ''}
      </span>
      {tr('Tout')}
      <small>{`${checked} / ${total}`}</small>
    </Button>
  );
}
