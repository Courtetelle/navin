import { registerBootHooks } from '../../shell/bootHooks.ts';
import { addNavigationListener } from '../../shell/router.ts';
import { setTopMenuActions } from '../../shell/topbar/topMenuState.ts';
import { hooks } from '../../state/index.ts';

import { startDepthWatch } from './depthAlarm.ts';
import { unlockDepthAudio } from './depthAudio.ts';
import { gpxImportPlan } from './gpxImport.ts';
import {
  autoResumeTrip,
  followPageLife,
  stopTracking,
} from './liveTracking.ts';
import { afterStop } from './trackerLink.ts';
import { cycleZone } from './zone.ts';

hooks.stopTracking = stopTracking;
registerBootHooks({ autoResumeTrip });
setTopMenuActions({
  stopTracking: () => stopTracking(true),
  afterStop,
  cycleZone,
});
addNavigationListener(({ phase }) => {
  if (phase === 'before') gpxImportPlan.value = null;
});
followPageLife();
unlockDepthAudio();
startDepthWatch();
