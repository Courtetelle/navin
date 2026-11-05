import { useLayoutEffect, useState } from 'react';

import { useIntroLead } from '../../components/shared/introLead.ts';
import { navigation } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

/** Last screen drawn: navigation id and title. */
let lastDrawn: { navigationId: number; title: string } | null = null;

/**
 * Whether the help under the title gets `help-lead`, for screens redrawn in
 * place: within one navigation it only depends on a change of title
 * (legacy `introToast`, nav.js:110-138).
 * @param title - Text of the `h1`.
 * @returns `true` on a fresh entry.
 */
export function useScreenLead(title: string): boolean {
  const navigationId = navigation.value.id;
  const fresh = useIntroLead(state.view.currentView.value, title);
  const [lead] = useState(() =>
    lastDrawn?.navigationId === navigationId
      ? lastDrawn.title !== title
      : fresh,
  );
  useLayoutEffect(() => {
    lastDrawn = { navigationId, title };
  }, [navigationId, title]);
  return lead;
}
