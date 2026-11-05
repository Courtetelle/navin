import { signal } from '@preact/signals-react';

import { setBodyClass } from '../../shell/bodyClass.ts';

import { prepFlow } from './prepTypes.ts';

/** The PréP bar is shown (crew page at step 3, check-in at step 4). */
export const prepBarShown = signal(false);

/**
 * Show the PréP bar on the screens that belong to a step (legacy
 * `prepBarSync`, run by `go` after every screen).
 * @param view - Screen opened.
 */
export function prepBarSync(view: string): void {
  const prep = prepFlow();
  const shown = Boolean(
    prep &&
    ((view === 'crew' && prep.step === 3) ||
      (view === 'checklist' && prep.step === 4)),
  );
  setBodyClass('prep-on', shown);
  prepBarShown.value = shown;
  if (shown) {
    void import('./prepBarRoot.ts').then(({ mountPrepBar }) => mountPrepBar());
  }
}
