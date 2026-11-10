import { hasBodyClass } from '../../shell/bodyClass.ts';
import { addNavigationListener } from '../../shell/router.ts';
import { setTopMenuActions } from '../../shell/topbar/topMenuState.ts';
import { addEscapeListener } from '../../shell/topbar/topTabGestures.ts';

import { gotoTarget, resumeGoto } from './goto.ts';
import { followGotoBar } from './gotoBarRoot.ts';
import { autoLakes } from './lakes.ts';
import { exitMapFull, onFullscreenChange } from './mapFull.ts';
import { stopMapWatch } from './mapWatch.ts';
import { closeNavPop } from './navPop.ts';
import { navinScaleTap } from './navinScale.ts';
import { drawTrkButtons } from './trackerButtons.ts';
import { trkPointNow } from './trackerPoint.ts';

const AUTO_LAKES_DELAY_MS = 6000;
const ONLINE_DELAY_MS = 3000;
const RESUME_GOTO_DELAY_MS = 500;

setTopMenuActions({
  pointNow: () => void trkPointNow(),
  scaleTap: navinScaleTap,
});
addNavigationListener(({ phase, to }) => {
  if (phase !== 'before') return;
  closeNavPop();
  drawTrkButtons();
  if (hasBodyClass('map-full')) exitMapFull();
  if (to !== 'map' && to !== 'tracker') stopMapWatch();
});
addEscapeListener(closeNavPop);
document.addEventListener('fullscreenchange', onFullscreenChange);
followGotoBar();
setTimeout(() => void autoLakes(), AUTO_LAKES_DELAY_MS);
globalThis.addEventListener('online', () => {
  setTimeout(() => void autoLakes(), ONLINE_DELAY_MS);
});
if (gotoTarget.value) setTimeout(resumeGoto, RESUME_GOTO_DELAY_MS);
