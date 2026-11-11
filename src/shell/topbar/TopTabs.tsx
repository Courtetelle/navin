import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import type { UiEdit } from '../../model/logTypes.ts';
import { state } from '../../state/index.ts';
import { litTab } from '../litTab.ts';
import { tipFocus } from '../tips.ts';
import { RollTrack } from '../uiEdit/RollTrack.tsx';
import { editClasses, editedChildren } from '../uiEdit/applyUiEdit.tsx';

import type { TabDisplay } from './tabDisplays.ts';
import { TAB_ORDER, tabDisplays } from './tabDisplays.ts';
import { faceIsEdited, tabEdit, tabEditKey } from './tabEdits.ts';
import type { TopTabKey } from './topMenuModel.ts';
import { leaveMenusOnTap, refreshBase } from './topMenuState.ts';
import { sosSimulation } from './topState.ts';
import {
  cancelTabPress,
  tabClick,
  tabKeyDown,
  tabPointerDown,
} from './topTabGestures.ts';

const TAB_ORIGINALS: Record<TopTabKey, string> = {
  tracker: 'NavIn',
  more: 'data',
  sos: '',
};

/** Menus that blink on their own button (pin, gear, VHF), not on data. */
const OWN_BUTTON = new Set(['marks', 'settings', 'vhf']);

const TAB_CLASS: Record<TopTabKey, string> = {
  tracker: 'tab top-tab',
  more: 'tab top-tab tab-data',
  sos: 'tab top-tab tab-sos',
};

/**
 * The three top tabs NavIn / data / SOS with their pictograms, their menus of
 * choices (tap = cycle, long press = launch) and the keyboard remote.
 * @returns The tab buttons (children of `nav.topnav`).
 */
export function TopTabs() {
  useSignals();
  const lit = litTab();
  useEffect(() => {
    const interval = setInterval(refreshBase, 1000);
    const onKey = (event: KeyboardEvent) => tabKeyDown(event, litTab());
    document.addEventListener('pointerup', cancelTabPress, { passive: true });
    document.addEventListener('pointercancel', cancelTabPress, {
      passive: true,
    });
    document.addEventListener('keydown', onKey);
    // A tap outside the tabs while a menu choice shows: back to NavIn, and
    // the tap is swallowed so it presses nothing under the finger.
    let swallow = false;
    const onPress = (event: PointerEvent) => {
      swallow = leaveMenusOnTap(event);
      if (swallow) event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('pointerdown', onPress, { capture: true });
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      clearInterval(interval);
      document.removeEventListener('pointerdown', onPress, { capture: true });
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('pointerup', cancelTabPress);
      document.removeEventListener('pointercancel', cancelTabPress);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <>
      {TAB_ORDER.map((key) => (
        <TopTab key={key} tab={key} active={lit === key} />
      ))}
    </>
  );
}

interface TopTabProps {
  tab: TopTabKey;
  active: boolean;
}

function TopTab({ tab, active }: TopTabProps) {
  useSignals();
  const view = state.view.currentView.value;
  const display = tabDisplays[tab].value;
  const focused = tipFocus.value === tab;
  const reference = useRef<HTMLButtonElement>(null);
  const { face, base, fits, measuredStaged } = display;
  const edit = tabEdit(tab);
  useLayoutEffect(() => {
    // The inline font size is measured, so it is written here, never by React.
    if (reference.current) fitFontSize(reference.current, measuredStaged);
  }, [fits, measuredStaged]);
  const classes = [
    TAB_CLASS[tab],
    active && 'active',
    // The data menu open: its button blinks yellow, as PréP (not SOS, not NavIn).
    active && tab === 'more' && !OWN_BUTTON.has(view) && 'menu-here',
    ...displayClasses(display),
    focused && 'tip-focus',
    ...editClasses(edit),
  ];
  const content = face.html
    ? face.html.map((markup) => (
        <Fragment key={markup}>{markupToReact(markup)}</Fragment>
      ))
    : face.label;
  return (
    <Button
      ref={reference}
      noUiEdit
      data-view={tab}
      data-base={base ?? undefined}
      data-ue-key={tabEditKey(tab)}
      data-ue-orig={TAB_ORIGINALS[tab]}
      className={classes.filter(Boolean).join(' ')}
      onPointerDown={() => tabPointerDown(tab)}
      onClick={() => tabClick(tab, active)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {edit && faceIsEdited(tab, face) ? (
        <EditedTab edit={edit}>{content}</EditedTab>
      ) : (
        content
      )}
      {tab === 'sos' && sosSimulation.value ? (
        <span className="sos-simu-tag" aria-hidden="true">
          SIMULATION
        </span>
      ) : null}
    </Button>
  );
}

function displayClasses({
  face,
  staged,
  stageStop,
  stopArmed,
  keyboardFocus,
}: TabDisplay): Array<string | false | undefined> {
  return [
    staged && 'staged',
    stageStop && 'stage-stop',
    stopArmed && 'stop-armed',
    face.bare && 'bare',
    face.box && 'ph-box',
    face.vhfOn && 'vhf-on',
    face.blink && 'menu-here',
    keyboardFocus && 'kbd-focus',
  ];
}

function EditedTab({ edit, children }: { edit: UiEdit; children: ReactNode }) {
  const edited = editedChildren(children, edit);
  return edit.wrap === 'roll' ? <RollTrack>{edited}</RollTrack> : edited;
}

/**
 * Shrink the label 1 px at a time until it fits, down to 12 px (legacy
 * `fitLabel`, prep.js:253).
 * Legacy measured before toggling `staged` / `stage-stop`, so the classes of
 * that moment are restored during the measure.
 * @param button - The tab.
 * @param measured - Classes legacy had while measuring.
 */
function fitFontSize(
  button: HTMLButtonElement,
  measured: { staged: boolean; stageStop: boolean },
): void {
  const { classList, style } = button;
  const staged = classList.contains('staged');
  const stageStop = classList.contains('stage-stop');
  classList.toggle('staged', measured.staged);
  classList.toggle('stage-stop', measured.stageStop);
  style.fontSize = '';
  let size = Number.parseFloat(globalThis.getComputedStyle(button).fontSize);
  let steps = 0;
  while (overflows(button) && size > 12 && steps++ < 12) {
    size -= 1;
    style.fontSize = `${size}px`;
  }
  classList.toggle('staged', staged);
  classList.toggle('stage-stop', stageStop);
}

function overflows(button: HTMLButtonElement): boolean {
  return button.scrollWidth > button.clientWidth + 1;
}
