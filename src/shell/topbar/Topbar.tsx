import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { state } from '../../state/index.ts';
import { BarChevron } from '../BarChevron.tsx';
import { hasBodyClass } from '../bodyClass.ts';
import { goFromGear, navigation, voyageName } from '../router.ts';
import { toggleTheme, toggleThemeFromGear } from '../theme.ts';
import { tipFocus } from '../tips.ts';

import { Clock } from './Clock.tsx';
import { TopTabs } from './TopTabs.tsx';

/**
 * The top bar: clock, hidden voyage name, the three tabs, the settings gear
 * (long press: night mode) and the hidden theme button. Keeps `--topbar-h`
 * and `--clock-fs` up to date (app.js:3288).
 * @returns The `header.topbar` element.
 */
export function Topbar() {
  useSignals();
  const reference = useRef<HTMLElement>(null);
  const night = state.preferences.settings.value.theme === 'night';
  useLayoutEffect(() => {
    const fix = () => {
      if (reference.current) setTopbarVariables(reference.current);
    };
    fix();
    const timer = setTimeout(fix, 300);
    globalThis.addEventListener('resize', fix);
    return () => {
      clearTimeout(timer);
      globalThis.removeEventListener('resize', fix);
    };
  }, []);
  // Legacy measured the bar 300 ms after start, on the tracker in `trk-mode`;
  // a lazily loaded tracker can arrive later, so measure when it does.
  const tracker = hasBodyClass('trk-mode');
  useLayoutEffect(() => {
    if (tracker && navigation.peek().id === 1 && reference.current) {
      setTopbarVariables(reference.current);
    }
  }, [tracker]);
  return (
    <header className="topbar" ref={reference}>
      <Clock />
      <div className="voyage" id="voyageName" hidden>
        {voyageName.value}
      </div>
      <nav className="topnav">
        <TopTabs />
      </nav>
      <GearButton focused={tipFocus.value === 'gear'} />
      <Button
        className="theme-btn"
        id="themeBtn"
        aria-label="Changer de mode"
        hidden
        onClick={toggleTheme}
      >
        {night ? '☾' : '☀︎'}
      </Button>
      <BarChevron bar="top" />
    </header>
  );
}

function setTopbarVariables(header: HTMLElement): void {
  const root = document.documentElement.style;
  root.setProperty('--topbar-h', `${header.offsetHeight}px`);
  const clock = header.querySelector('.clock');
  if (clock) {
    root.setProperty('--clock-fs', globalThis.getComputedStyle(clock).fontSize);
  }
}

const GEAR_PATH = 'M6 12h20M36 12h6M6 24h5M21 24h21M6 36h24M40 36h2';
let gearTimer: ReturnType<typeof setTimeout> | undefined;
let gearLongPress = false;

function cancelGear(): void {
  clearTimeout(gearTimer);
}

function GearButton({ focused }: { focused: boolean }) {
  useEffect(() => () => clearTimeout(gearTimer), []);
  return (
    <Button
      className={focused ? 'theme-btn tip-focus' : 'theme-btn'}
      id="gearBtn"
      aria-label="Réglages"
      onPointerDown={() => {
        gearLongPress = false;
        clearTimeout(gearTimer);
        gearTimer = setTimeout(() => {
          gearLongPress = true;
          toggleThemeFromGear();
        }, 650);
      }}
      onPointerUp={cancelGear}
      onPointerLeave={cancelGear}
      onPointerCancel={cancelGear}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (gearLongPress) {
          gearLongPress = false;
          return;
        }
        buzz();
        goFromGear();
      }}
    >
      <svg
        className="gear-ico gear-sliders"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        >
          <path d={GEAR_PATH} />
          <circle cx="31" cy="12" r="4.6" />
          <circle cx="16" cy="24" r="4.6" />
          <circle cx="35" cy="36" r="4.6" />
        </g>
      </svg>
    </Button>
  );
}
