import { effect } from '@preact/signals-react';
import { useLayoutEffect } from 'react';

import { installDecimalComma } from '../components/shared/decimalComma.ts';
import { state } from '../state/index.ts';
import { attachErrorLog } from '../storage/errLog.ts';

import { runBootHook } from './bootHooks.ts';
import { loadDomains } from './domainInit.ts';
import { errorContext } from './errorContext.ts';
import { installFrameLinks } from './frameLinks.ts';
import { preloadPages } from './pageRegistry.ts';
import { installParityHook, parityStarted } from './parityHook.ts';
import { addNavigationListener, go } from './router.ts';
import { installTapScrollHold } from './scrollAnchor.ts';
import { followTheme } from './theme.ts';
import { scheduleBootTip } from './tips.ts';
import { installToastListeners } from './toast/toastTouch.ts';
import { tickClock } from './topbar/clockState.ts';
import { followTabEdits } from './topbar/tabEdits.ts';
import { refreshBase, resetTab } from './topbar/topMenuState.ts';
import { followTopState } from './topbar/topState.ts';
import { installRollListeners } from './uiEdit/rollListeners.ts';
import { installUiEditCatch } from './uiEdit/uiEditState.ts';
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
  installUiEditCatch();
  installRollListeners();
  installFrameLinks();
  installTapScrollHold();
  effect(() => {
    document.documentElement.classList.toggle(
      'no-help-i',
      Boolean(state.preferences.settings.value.noHelpI),
    );
  });
  followTheme();
  followTopState();
  tickClock();
  setInterval(tickClock, 10_000);
  followWake();
  setTimeout(() => {
    resetTab('sos');
    resetTab('more');
  }, 0);
  addNavigationListener((event) => {
    if (event.phase === 'after') setTimeout(refreshBase, 0);
  });
  scheduleBootTip();
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
  navigator.serviceWorker.register('sw.js').catch(() => undefined);
}
