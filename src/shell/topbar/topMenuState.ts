import { batch } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { RAILS_QUERY } from '../../lib/useWide.ts';
import { navZone, prepReady, state, toast } from '../../state/index.ts';
import { clearToast } from '../../state/toast.ts';
import { hasBodyClass } from '../bodyClass.ts';
import { go } from '../router.ts';

import {
  TAB_ORDER,
  domainActions,
  fitted,
  tabDisplays,
} from './tabDisplays.ts';
import { STOP_SVG } from './tabIcons.ts';
import type { TopMenuContext, TopMenuItem, TopTabKey } from './topMenuModel.ts';
import { topMenu } from './topMenuModel.ts';

export { setTopMenuActions } from './tabDisplays.ts';

const stageTimers: Partial<Record<TopTabKey, ReturnType<typeof setTimeout>>> =
  {};
let armTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Context of the menus, read from the state.
 * @returns Screen, PréP, tracking and zone.
 */
function menuContext(): TopMenuContext {
  const currentView = state.view.currentView.value;
  const prepActive = state.data.prep.value !== null;
  return {
    currentView,
    prepActive,
    inPrep: prepActive && (currentView === 'prep' || hasBodyClass('prep-on')),
    tracking: state.view.tracking.value,
    prepReady: prepReady.value,
    zone: navZone(),
    wide:
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia(RAILS_QUERY).matches,
  };
}

/**
 * Current menu items of a tab.
 * @param key - Tab.
 * @returns Its items.
 */
export function menuItems(key: TopTabKey): TopMenuItem[] {
  return topMenu(key, menuContext(), {
    go,
    armStop,
    prepStart: () => domainActions.prepStart(),
    quickStart: () => domainActions.quickStart(),
    pointNow: () => domainActions.pointNow(),
    moorNow: () => domainActions.moorNow(),
  });
}

/**
 * Show the tab name again (legacy `reset`, prep.js:267).
 * @param key - Tab.
 */
export function resetTab(key: TopTabKey): void {
  const display = tabDisplays[key];
  if (key === 'tracker' && display.value.stopArmed) return;
  clearTimeout(stageTimers[key]);
  const [first] = menuItems(key);
  if (!first) return;
  display.value = {
    ...display.value,
    face: first,
    base: first.label,
    ...fitted(display.value),
    index: 0,
    staged: false,
    stageStop: false,
  };
}

/** Show every tab name again (legacy `navinTopReset` resets NavIn and SOS). */
export function resetTopTabs(): void {
  resetTab('tracker');
  resetTab('sos');
}

/**
 * Show one choice of a tab, with its hint (legacy `show`, prep.js:259).
 * @param key - Tab.
 * @param index - Item index (wraps around).
 */
export function showChoice(key: TopTabKey, index: number): void {
  const items = menuItems(key);
  const position = index % items.length;
  const item = items[position];
  if (!item) return;
  tabDisplays[key].value = {
    ...tabDisplays[key].value,
    face: item,
    ...fitted(tabDisplays[key].value),
    index: position,
    staged: position > 0,
    stageStop: Boolean(item.stop),
  };
  if (item.hint) toast(item.hint);
  clearTimeout(stageTimers[key]);
  if (position > 0) {
    stageTimers[key] = setTimeout(() => resetTab(key), 5000);
  }
}

/**
 * A tap anywhere outside the top tabs while a menu choice is shown: back to
 * the tab names, and the tap does nothing else (it only leaves the menu).
 * @param event - The pointer press.
 * @returns `true` when a menu was left.
 */
export function leaveMenusOnTap(event: Event): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.top-tab')) return false;
  const open = (Object.keys(tabDisplays) as TopTabKey[]).filter((key) => {
    const display = tabDisplays[key].value;
    return display.index > 0 || display.stopArmed;
  });
  if (open.length === 0) return false;
  for (const key of open) {
    if (key === 'tracker' && tabDisplays.tracker.value.stopArmed) disarmStop();
    else resetTab(key);
  }
  clearToast();
  return true;
}

/** Keep the NavIn name in line with PréP, tracking and VHF (prep.js:273, every second). */
export function refreshBase(): void {
  const display = tabDisplays.tracker;
  const current = display.value;
  if (current.stopArmed || current.index > 0) return;
  const [first] = menuItems('tracker');
  if (!first || current.base === first.label) return;
  display.value = {
    ...current,
    face: first,
    base: first.label,
    ...fitted(current),
  };
}

/** FIN chosen: the tab turns into a red sign waiting for a confirmation tap (prep.js:321). */
export function armStop(): void {
  resetTab('tracker');
  buzz();
  const display = tabDisplays.tracker;
  display.value = {
    ...display.value,
    face: {
      ...display.value.face,
      html: [STOP_SVG.replace('class="tb-ico ', 'class="tb-ico tb-armed ')],
      bare: true,
    },
    stopArmed: true,
  };
  toast(
    'Toucher encore (ou Entrée) pour confirmer l’arrêt de la trace · sinon rien dans 5 s',
  );
  clearTimeout(armTimer);
  armTimer = setTimeout(disarmStop, 5000);
}

/** Cancel an armed stop. */
function disarmStop(): void {
  clearTimeout(armTimer);
  tabDisplays.tracker.value = {
    ...tabDisplays.tracker.value,
    stopArmed: false,
  };
  resetTab('tracker');
}

/** Confirmed stop: green tick for 3 s, the recording ends (prep.js:328). */
export async function stopNow(): Promise<void> {
  disarmStop();
  buzz();
  // The tick shows on the track button itself, never on NavIn.
  if (state.view.tracking.value) await domainActions.stopTracking();
  if (state.view.currentView.value !== 'tracker') go('tracker');
  domainActions.afterStop();
  toast('■ Trace arrêtée');
}

/**
 * Set the keyboard focus flag of every tab.
 * @param focused - Tab focused, or null for none.
 */
export function setKeyboardFocus(focused: TopTabKey | null): void {
  batch(() => {
    for (const key of TAB_ORDER) {
      const display = tabDisplays[key];
      if (display.value.keyboardFocus !== (key === focused)) {
        display.value = { ...display.value, keyboardFocus: key === focused };
      }
    }
  });
}
