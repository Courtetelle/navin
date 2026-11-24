import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { SettingsIcon } from '../../components/shared/SettingsIcon.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { editRoute } from '../../features/map/routeEditor.ts';
import {
  ROUTE_ICON,
  ROUTE_NEW_ICON,
  ROUTE_WX_ICON,
  routesPart,
} from '../../features/map/routeMode.ts';
import { clearRouting } from '../../features/map/routingShown.ts';
import { shownRouting } from '../../features/map/routingState.ts';
import { buzz } from '../../lib/dom.ts';
import { railsScreen } from '../../lib/useWide.ts';
import { state, toast } from '../../state/index.ts';
import { BarChevron } from '../BarChevron.tsx';
import { hasBodyClass } from '../bodyClass.ts';
import { inMenu, menuButtonPress } from '../menuOwner.ts';
import { closeMenus, menusOpen } from '../menusRoll.ts';
import { navBack } from '../navbar/navActions.ts';
import { navinRowChosen } from '../navinRow.ts';
import { go, goFromGear, navigation, voyageName } from '../router.ts';
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
      <RoutesButton />
      <RoutesUnroll />
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

let gearTimer: ReturnType<typeof setTimeout> | undefined;
let gearLongPress = false;

function cancelGear(): void {
  clearTimeout(gearTimer);
}

function GearButton({ focused }: { focused: boolean }) {
  useSignals();
  useEffect(() => () => clearTimeout(gearTimer), []);
  // The settings open: the gear blinks yellow, as PréP.
  const here =
    state.view.currentView.value === 'settings' || inMenu('settings');
  return (
    <Button
      className={['theme-btn', focused && 'tip-focus', here && 'menu-here']
        .filter(Boolean)
        .join(' ')}
      id="gearBtn"
      aria-label="Paramétrages"
      onPointerDown={() => {
        gearLongPress = false;
        clearTimeout(gearTimer);
        // Landscape tablet: night and day are on NavIn now.
        if (railsScreen()) return;
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
        navinRowChosen();
        // One step back in a page of the settings, as data.
        // A section is a page of the menu: one step back to it first.
        menuButtonPress(
          'settings',
          navBack,
          goFromGear,
          () =>
            state.view.currentView.value === 'settings' &&
            !state.view.viewArg.value,
        );
      }}
    >
      <SettingsIcon />
    </Button>
  );
}

/**
 * Routes, between data and the settings: the routes drawn on the map. Its
 * own button, out of data; it blinks while its page shows.
 * @returns The button.
 */
function RoutesButton() {
  useSignals();
  const here = state.view.currentView.value === 'routes' || inMenu('routes');
  // A routing on the map: the button stays shown with a red cross blinking
  // on it, a tap leaves the routing (back to the map, and the track).
  const routing = shownRouting.value !== null;
  return (
    <Button
      className={[
        'theme-btn',
        'routes-top',
        here && !routing && 'menu-here',
        routing && 'routing-on',
      ]
        .filter(Boolean)
        .join(' ')}
      id="routesBtn"
      aria-label={routing ? 'Sortir du routage' : 'Routes'}
      title={routing ? 'Sortir du routage' : 'Routes'}
      onClick={() => {
        buzz();
        if (shownRouting.peek()) {
          clearRouting();
          if (state.view.currentView.peek() !== 'tracker') go('tracker');
          toast('Sortie du routage : retour à la carte');
          return;
        }
        navinRowChosen();
        menuButtonPress('routes', navBack);
      }}
    >
      <span className="routes-ico">{markupToReact(ROUTE_ICON)}</span>
      {routing ? (
        <svg
          className="routes-x"
          viewBox="0 0 40 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="live-radius-cross"
            d="M5 5l30 30m0-30-30 30"
            stroke="#e00016"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </Button>
  );
}

/**
 * Under Routes (at its left upright), unrolled and faded with it: « Nouvelle
 * route », drawn at once on the map of NavIn, and « Routage météo ».
 * @returns The two buttons, or nothing while Routes is rolled.
 */
function RoutesUnroll() {
  useSignals();
  if (!menusOpen.value) return null;
  return (
    <>
      <Button
        type="button"
        noUiEdit
        className="rail-btn routes-sub routes-sub-new"
        id="routeNewBtn"
        aria-label="Nouvelle route"
        title="Nouvelle route"
        onClick={() => {
          buzz();
          closeMenus();
          editRoute(null);
        }}
      >
        <span className="rail-icon">{markupToReact(ROUTE_NEW_ICON)}</span>
      </Button>
      <Button
        type="button"
        noUiEdit
        className="rail-btn routes-sub routes-sub-wx"
        id="routeWxBtn"
        aria-label="Routage météo"
        title="Routage météo"
        onClick={() => {
          buzz();
          closeMenus();
          routesPart.value = 'routing';
          go('routes');
        }}
      >
        <span className="rail-icon">{markupToReact(ROUTE_WX_ICON)}</span>
      </Button>
    </>
  );
}
