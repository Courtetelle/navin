import type { MouseEvent } from 'react';

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
  const state = masterState(checked, total);
  const data = { [attribute]: '1' };
  return (
    <button
      type="button"
      className={`btn check ck-master ${state}`}
      {...data}
      onClick={onClick}
    >
      <span className="box">
        {state === 'on' ? '✔' : state === 'part' ? '–' : ''}
      </span>
      Tout<small>{`${checked} / ${total}`}</small>
    </button>
  );
}
