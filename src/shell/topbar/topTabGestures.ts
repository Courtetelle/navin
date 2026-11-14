import { buzz } from '../../lib/dom.ts';
import { railsScreen } from '../../lib/useWide.ts';
import { state, toast } from '../../state/index.ts';
import { menuButtonPress } from '../menuOwner.ts';
import { navBack } from '../navbar/navActions.ts';
import { closeNavinRow, navinRowChosen, toggleNavinRow } from '../navinRow.ts';
import { go } from '../router.ts';

import { TAB_ORDER, tabDisplays, topMenuDomainActions } from './tabDisplays.ts';
import type { TopTabKey } from './topMenuModel.ts';
import {
  menuItems,
  resetTab,
  setKeyboardFocus,
  showChoice,
  stopNow,
} from './topMenuState.ts';

let pressTimer: ReturnType<typeof setTimeout> | undefined;

/** X or T: NavIn holds a row of menus. */
function wideScreen(): boolean {
  return railsScreen();
}
let fired = false;
let keyboardTab: TopTabKey | null = null;
let keyboardTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Pointer down on a tab: a long press (650 ms) launches the choice shown
 * (prep.js:284-301).
 * @param key - Tab pressed.
 */
export function tabPointerDown(key: TopTabKey): void {
  fired = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    fired = true;
    const items = menuItems(key);
    const item = items[tabDisplays[key].value.index] ?? items[0];
    if (!item) return;
    if (item.base && key === 'sos') {
      fired = false;
      return;
    }
    if (item.base && key === 'tracker' && item.label === 'NavIn') {
      resetTab(key);
      // The long press on NavIn turns the zone: Atlantique, Méditerranée,
      // Lacs, its logo following (night and day are on the magnifier).
      buzz();
      topMenuDomainActions().cycleZone();
      return;
    }
    if (item.base) return;
    buzz();
    if (item.stop) {
      item.act();
      return;
    }
    toast(`✓ ${item.label}`);
    resetTab(key);
    item.act();
  }, 650);
}

/** Any pointer up / cancel cancels a pending long press. */
export function cancelTabPress(): void {
  clearTimeout(pressTimer);
}

/**
 * Tap on a tab (prep.js:304-318): opens its page, then cycles its choices.
 * @param key - Tab tapped.
 * @param active - The tab is lit.
 */
export function tabClick(key: TopTabKey, active: boolean): void {
  if (fired) {
    fired = false;
    return;
  }
  if (key === 'tracker' && tabDisplays.tracker.value.stopArmed) {
    void stopNow();
    return;
  }
  buzz();
  if (key === 'sos') {
    for (const other of TAB_ORDER) resetTab(other);
    topMenuDomainActions().sosTap();
    go('sos');
    showBaseHint('sos');
    return;
  }
  // Landscape tablet: NavIn unrolls its row of menus at its right, or rolls
  // it back.
  if (key === 'tracker' && wideScreen()) {
    for (const other of TAB_ORDER) if (other !== key) resetTab(other);
    // Away from the map, NavIn rolls its row back and brings the map.
    if (state.view.currentView.value !== 'tracker') {
      closeNavinRow();
      go('tracker');
      return;
    }
    toggleNavinRow();
    return;
  }
  // data: one step back at each touch inside its menu, the same rule as the
  // other menu buttons.
  if (key === 'more') {
    navinRowChosen();
    for (const other of TAB_ORDER) resetTab(other);
    menuButtonPress('more', navBack);
    return;
  }
  const onItsPage = active && state.view.currentView.value !== 'settings';
  // NavIn only bringing back the map (tablet): a scale at each touch.
  if (key === 'tracker' && menuItems(key).length < 2) {
    for (const other of TAB_ORDER) if (other !== key) resetTab(other);
    topMenuDomainActions().scaleTap(state.view.currentView.value === 'tracker');
    return;
  }
  const index = tabDisplays[key].value.index;
  if (!onItsPage && !(index > 0)) {
    for (const other of TAB_ORDER) if (other !== key) resetTab(other);
    go(key);
    showBaseHint(key);
    return;
  }
  for (const other of TAB_ORDER) if (other !== key) resetTab(other);
  const count = menuItems(key).length;
  if (count < 2) {
    go(key);
    return;
  }
  showChoice(key, (index % (count - 1)) + 1);
}

/**
 * Keyboard and Bluetooth remote (prep.js:360-381): ← → cycle the choices,
 * ↑ ↓ change tab, Enter / Space validate, Escape closes a popup.
 * @param event - Key event.
 * @param activeTab - Tab currently lit.
 */
export function tabKeyDown(
  event: KeyboardEvent,
  activeTab: string | null,
): void {
  const target = event.target as HTMLElement | null;
  if (target?.isContentEditable) return;
  if (target && /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  const current = (): TopTabKey =>
    keyboardTab ?? TAB_ORDER.find((key) => key === activeTab) ?? 'tracker';
  const { key, repeat } = event;
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    event.preventDefault();
    const tab = current();
    const count = tab === 'sos' ? 1 : menuItems(tab).length;
    buzz();
    if (count < 2) {
      focusTab(tab, 0);
      return;
    }
    const index =
      tabDisplays[tab].value.index || (key === 'ArrowRight' ? 0 : 1);
    focusTab(
      tab,
      key === 'ArrowRight'
        ? (index % (count - 1)) + 1
        : ((index - 2 + (count - 1)) % (count - 1)) + 1,
    );
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(key)) {
    event.preventDefault();
    const step =
      key === 'ArrowDown' || key === 'PageDown' ? 1 : TAB_ORDER.length - 1;
    buzz();
    const next =
      TAB_ORDER[(TAB_ORDER.indexOf(current()) + step) % TAB_ORDER.length];
    if (next) focusTab(next, 0);
    return;
  }
  if (['Enter', ' ', 'Spacebar'].includes(key)) {
    event.preventDefault();
    if (!repeat) validate(current());
    return;
  }
  if (key === 'Escape') {
    for (const listener of escapeListeners) listener();
    const close = document.querySelector<HTMLElement>(
      '.overlay .close, [data-close]',
    );
    close?.click();
  }
}

const escapeListeners = new Set<() => void>();

/**
 * Run a function when Escape is pressed outside a text field (legacy closes
 * the map popup there, prep.js:378).
 * @param listener - Called on Escape.
 * @returns Unsubscribe function.
 */
export function addEscapeListener(listener: () => void): () => void {
  escapeListeners.add(listener);
  return () => {
    escapeListeners.delete(listener);
  };
}

function focusTab(key: TopTabKey, index: number): void {
  setKeyboardFocus(key);
  for (const other of TAB_ORDER) if (other !== key) resetTab(other);
  keyboardTab = key;
  showChoice(key, index);
  clearTimeout(keyboardTimer);
  keyboardTimer = setTimeout(() => {
    setKeyboardFocus(null);
    for (const other of TAB_ORDER) resetTab(other);
    keyboardTab = null;
  }, 5000);
}

function validate(key: TopTabKey): void {
  const items = menuItems(key);
  const item = items[tabDisplays[key].value.index] ?? items[0];
  if (key === 'tracker' && tabDisplays.tracker.value.stopArmed) {
    void stopNow();
    return;
  }
  if (!item || item.base) return;
  buzz();
  clearTimeout(keyboardTimer);
  setKeyboardFocus(null);
  keyboardTab = null;
  if (item.stop) {
    item.act();
    return;
  }
  toast(`✓ ${item.label}`);
  resetTab(key);
  item.act();
}

function showBaseHint(key: TopTabKey): void {
  const hint = menuItems(key)[0]?.hint;
  if (hint) toast(hint);
}
