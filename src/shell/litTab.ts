import { state } from '../state/index.ts';

import { hasBodyClass } from './bodyClass.ts';
import { routedTab } from './router.ts';

/**
 * Tab lit now: the one `go` chose, or NavIn while the PréP is shown (prep.js:275).
 * Reading it in a component or a `computed` subscribes to its inputs.
 * @returns The `data-view` of the lit tab, or null.
 */
export function litTab(): string | null {
  const prepActive = state.data.prep.value !== null;
  const view = state.view.currentView.value;
  const inPrep = prepActive && (view === 'prep' || hasBodyClass('prep-on'));
  return inPrep ? 'tracker' : routedTab.value;
}
