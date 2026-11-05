import { useSignals } from '@preact/signals-react/runtime';
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { litTab } from '../litTab.ts';
import { tipFocus } from '../tips.ts';

import { TAB_ORDER, tabDisplays } from './tabDisplays.ts';
import type { TopTabKey } from './topMenuModel.ts';
import { refreshBase } from './topMenuState.ts';
import { sosSimulation } from './topState.ts';
import {
  cancelTabPress,
  tabClick,
  tabKeyDown,
  tabPointerDown,
} from './topTabGestures.ts';

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
    return () => {
      clearInterval(interval);
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
  const display = tabDisplays[tab].value;
  const focused = tipFocus.value === tab;
  const reference = useRef<HTMLButtonElement>(null);
  const { face, base, staged, stageStop, stopArmed, keyboardFocus, fits } =
    display;
  const { measuredStaged } = display;
  useLayoutEffect(() => {
    // The inline font size is measured, so it is written here, never by React.
    if (reference.current) fitFontSize(reference.current, measuredStaged);
  }, [fits, measuredStaged]);
  const classes = [
    TAB_CLASS[tab],
    active && 'active',
    staged && 'staged',
    stageStop && 'stage-stop',
    stopArmed && 'stop-armed',
    face.bare && 'bare',
    face.box && 'ph-box',
    face.vhfOn && 'vhf-on',
    keyboardFocus && 'kbd-focus',
    focused && 'tip-focus',
  ];
  return (
    <Button
      ref={reference}
      noUiEdit
      data-view={tab}
      data-base={base ?? undefined}
      className={classes.filter(Boolean).join(' ')}
      onPointerDown={() => tabPointerDown(tab)}
      onClick={() => tabClick(tab, active)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {face.html
        ? face.html.map((markup) => (
            <Fragment key={markup}>{markupToReact(markup)}</Fragment>
          ))
        : face.label}
      {tab === 'sos' && sosSimulation.value ? (
        <span className="sos-simu-tag" aria-hidden="true">
          SIMULATION
        </span>
      ) : null}
    </Button>
  );
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
