import { addNavigationListener } from '../../shell/router.ts';

import { prepareScreen } from './screens.ts';

addNavigationListener(prepareScreen);
