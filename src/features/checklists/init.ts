import { addNavigationListener } from '../../shell/router.ts';

import { prepareChecklists } from './checklistNavigation.ts';

addNavigationListener(({ phase, to, arg }) => {
  if (phase === 'before') prepareChecklists(to, arg);
});
