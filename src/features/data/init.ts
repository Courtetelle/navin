import { registerBootHooks } from '../../shell/bootHooks.ts';

import { applyIcon } from './appIcon.ts';
import { listenForInstallPrompt } from './install.ts';

registerBootHooks({ applyIcon });
listenForInstallPrompt();
