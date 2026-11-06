import { setBodyClass } from '../../shell/bodyClass.ts';

import type { PrepFlow } from './prepTypes.ts';
import { prepFlow } from './prepTypes.ts';

/**
 * Whether a screen belongs to the step of the PréP: the crew page at step 3,
 * the check-in at step 4.
 * @param view - Screen.
 * @param prep - PréP flow.
 * @returns `true` when the PréP bar is shown.
 */
export function prepBarApplies(view: string, prep: PrepFlow | null): boolean {
  if (!prep) return false;
  return (
    (view === 'crew' && prep.step === 3) ||
    (view === 'checklist' && prep.step === 4)
  );
}

/**
 * Set `body.prep-on` on the screens that belong to a step (legacy
 * `prepBarSync`, run by `go` after every screen). `PrepBarHost` shows the bar.
 * @param view - Screen opened.
 */
export function prepBarSync(view: string): void {
  setBodyClass('prep-on', prepBarApplies(view, prepFlow()));
}
