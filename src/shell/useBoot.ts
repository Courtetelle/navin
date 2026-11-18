import { effect } from '@preact/signals-react';
import { useLayoutEffect } from 'react';

import { installDecimalComma } from '../components/shared/decimalComma.ts';
import {
  applyKeyLink,
  applySkipperMenus,
  followBoatRadio,
  followSettingsElsewhere,
  renumberDuplicateMarks,
  state,
} from '../state/index.ts';
import { attachErrorLog } from '../storage/errLog.ts';

import { followAutoNight } from './autoNight.ts';
import { runBootHook } from './bootHooks.ts';
import { installChromeLinks } from './chromeLinks.ts';
import { loadDomains } from './domainInit.ts';
import { errorContext } from './errorContext.ts';
import { installFrameLinks } from './frameLinks.ts';
import { preloadPages } from './pageRegistry.ts';
import { installParityHook, parityStarted } from './parityHook.ts';
import { installPressFeedback } from './pressFeedback.ts';
import { addNavigationListener, go } from './router.ts';
import { followScreenGap } from './screenGap.ts';
import { installTapScrollHold } from './scrollAnchor.ts';
import { followTheme } from './theme.ts';
import { scheduleBootTip } from './tips.ts';
import { installToastListeners } from './toast/toastTouch.ts';
import { endSunTimes, tickClock } from './topbar/clockState.ts';
import { followTabEdits } from './topbar/tabEdits.ts';
import { refreshBase, resetTab } from './topbar/topMenuState.ts';
import { followTopState } from './topbar/topState.ts';
import { installRollListeners } from './uiEdit/rollListeners.ts';
import { followWake } from './wake.ts';

let booted = false;

/** Start the app once, before the first paint (legacy `boot`, app.js:3282). */
export function useBoot(): void {
  useLayoutEffect(() => {
    if (booted) return;
    booted = true;
    boot();
  }, []);
}

function boot(): void {
  attachErrorLog(globalThis as unknown as Window, errorContext);
  installParityHook();
  installToastListeners();
  installDecimalComma();
  installRollListeners();
  installFrameLinks();
  // Links to other sites open in Chrome, NavIn stays beside them.
  installChromeLinks();
  installTapScrollHold();
  installPressFeedback();
  effect(() => {
    document.documentElement.classList.toggle(
      'no-help-i',
      Boolean(state.preferences.settings.value.noHelpI),
    );
  });
  followTheme();
  // The VHF of a sea cruise is the one of its boat sheet.
  followBoatRadio();
  // The settings changed in another window of NavIn are taken here too.
  followSettingsElsewhere();
  // The menus the skipper sent, made those of the app (once).
  applySkipperMenus();
  // Two marks with one number (made on two devices): new numbers.
  renumberDuplicateMarks();
  // Opened by the camera on the QR code of a key: the key is saved.
  const keyCame = applyKeyLink();
  followScreenGap();
  followAutoNight();
  followTopState();
  tickClock();
  setInterval(tickClock, 10_000);
  followWake();
  setTimeout(() => {
    resetTab('sos');
    resetTab('more');
  }, 0);
  addNavigationListener((event) => {
    if (event.phase === 'before') endSunTimes();
    if (event.phase === 'after') setTimeout(refreshBase, 0);
  });
  if (!keyCame) scheduleBootTip();
  void loadDomains().then(start);
}

function start(): void {
  runBootHook('applyIcon');
  runBootHook('autoResumeTrip');
  go('tracker');
  setTimeout(followTabEdits, 0);
  parityStarted();
  registerServiceWorker();
  navigator.storage?.persist?.().catch(() => undefined);
  preloadPages();
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (globalThis.location.protocol === 'file:') return;
  navigator.serviceWorker
    .register('sw.js')
    .then((registration) => {
      // A new version is looked for every 30 min and on each return to the
      // app, on every device.
      setInterval(() => {
        registration.update().catch(() => undefined);
      }, UPDATE_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => undefined);
        }
      });
    })
    .catch(() => undefined);
  // A new version took over: it opens at the next return to the app, never
  // during a track or a SOS.
  let fresh = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    fresh = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (!fresh || document.visibilityState !== 'visible') return;
    if (state.view.tracking.value || state.view.currentView.value === 'sos') {
      return;
    }
    globalThis.location.reload();
  });
}

/** How often a new version of NavIn is looked for. */
const UPDATE_EVERY_MS = 30 * 60_000;
