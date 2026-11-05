import { addNavigationListener } from '../../shell/router.ts';

import { enterCrewView } from './screen.ts';

addNavigationListener(({ phase, to }) => {
  if (phase === 'after') enterCrewView(to);
});
