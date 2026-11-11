import type { Signal } from '@preact/signals-react';
import { signal } from '@preact/signals-react';

import type { TabFace, TopTabKey } from './topMenuModel.ts';

/** How a top tab is drawn right now. */
export interface TabDisplay {
  face: TabFace;
  /** `data-base` attribute (null: absent). */
  base: string | null;
  /** Menu item shown (0 = the tab name). */
  index: number;
  /** A choice other than the name is shown (class `staged`). */
  staged: boolean;
  /** The FIN choice is shown (class `stage-stop`). */
  stageStop: boolean;
  /** The stop is armed, waiting for a confirmation tap (class `stop-armed`). */
  stopArmed: boolean;
  /** Focused with the keyboard or a remote (class `kbd-focus`). */
  keyboardFocus: boolean;
  /**
   * Increases each time the label is set (legacy `setLabel`, which re-fits the
   * font size); the stop and done signs replace the drawing without a fit.
   */
  fits: number;
  /** `staged` / `stage-stop` when the label was set (legacy measured before toggling them). */
  measuredStaged: { staged: boolean; stageStop: boolean };
}

/** Actions of other domains the top menus trigger. */
export interface TopMenuDomainActions {
  /** Start the step by step PréP (prep.js:385). */
  prepStart: () => void;
  /** Start a track at once (prep.js:109). */
  quickStart: () => void;
  /** Pin a point on the track (map.js:589). */
  pointNow: () => void;
  /** Moor: end the track, then check-out (prep.js:744). */
  moorNow: () => void;
  /** Stop the recording (auto.js:459, `stopTracking(true)`). */
  stopTracking: () => Promise<void> | void;
  /** Redraw the tracker after a stop (`trkReset`, `drawTrkButtons`, `updateTrkDash`, `drawTrkList`). */
  afterStop: () => void;
  /** Next zone of the zone cycle (`zoneSet(ZONE_CYC[next])`, nav.js:304). */
  cycleZone: () => void;
  /** SOS tab tap before opening the SOS page (`sosLogStart`, prep.js:312). */
  sosTap: () => void;
  /**
   * NavIn when it only brings back the map (landscape tablet): the map at
   * 3 NM, or on the map the next scale.
   */
  scaleTap: (onMap: boolean) => void;
}

const noop = () => {
  // Not provided yet by its domain.
};

export const domainActions: TopMenuDomainActions = {
  prepStart: noop,
  quickStart: noop,
  pointNow: noop,
  moorNow: noop,
  stopTracking: noop,
  afterStop: noop,
  cycleZone: noop,
  sosTap: noop,
  scaleTap: noop,
};

export function fitted(
  display: TabDisplay,
): Pick<TabDisplay, 'fits' | 'measuredStaged'> {
  return {
    fits: display.fits + 1,
    measuredStaged: { staged: display.staged, stageStop: display.stageStop },
  };
}

/**
 * Plug domain actions into the top menus.
 * @param actions - Actions to replace.
 */
export function setTopMenuActions(
  actions: Partial<TopMenuDomainActions>,
): void {
  Object.assign(domainActions, actions);
}

function initial(label: string): TabDisplay {
  return {
    face: { label },
    base: null,
    index: 0,
    staged: false,
    stageStop: false,
    stopArmed: false,
    keyboardFocus: false,
    fits: 0,
    measuredStaged: { staged: false, stageStop: false },
  };
}

/** Display of each tab. */
export const tabDisplays: Record<TopTabKey, Signal<TabDisplay>> = {
  tracker: signal(initial('NavIn')),
  more: signal(initial('data')),
  sos: signal(initial('SOS')),
};

/** Tab keys in screen order. */
export const TAB_ORDER: readonly TopTabKey[] = ['tracker', 'more', 'sos'];

/**
 * Domain actions used by the tab gestures (zone cycle, SOS tap).
 * @returns The registered actions.
 */
export function topMenuDomainActions(): Readonly<TopMenuDomainActions> {
  return domainActions;
}
