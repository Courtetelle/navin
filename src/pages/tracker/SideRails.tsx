import { signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { shownMap } from '../../features/map/mapFull.ts';
import { mapOrientation } from '../../features/map/mapOrientation.ts';
import {
  boatArrowTap,
  boatOrientPress,
} from '../../features/map/navinScale.ts';
import {
  DIVIDERS_ICON,
  flipRuler,
  rulerOn,
} from '../../features/map/rulerTool.ts';
import { trkPointNow } from '../../features/map/trackerPoint.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { takePhoto } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { useWide } from '../../lib/useWide.ts';
import { hasBodyClass } from '../../shell/bodyClass.ts';
import { inMenu, menuButtonPress } from '../../shell/menuOwner.ts';
import { navBack } from '../../shell/navbar/navActions.ts';
import { navinRowChosen, navinRowOpen } from '../../shell/navinRow.ts';
import { go } from '../../shell/router.ts';
import type { FunctionEntry } from '../../shell/search/searchIndex.ts';
import { functionEntries } from '../../shell/search/searchIndex.ts';
import { domainActions } from '../../shell/topbar/tabDisplays.ts';
import {
  FLAG_SVG,
  FLAG_WAVE_SVG,
  MOOR_SVG,
  START_SVG,
} from '../../shell/topbar/tabIcons.ts';
import {
  addMark,
  isLake,
  navZone,
  prepReady,
  state,
  toast,
  wxCheckState,
} from '../../state/index.ts';

import { TrackDoneButton, TrackRailButton } from './TrackRailButton.tsx';
import { RailIcon } from './railIcons.tsx';
import { MAP_ACTIONS, splitTitle } from './sideRails.ts';
import { trackDone } from './trackDone.ts';

/** A GPS position older than this is read again. */
const FRESH_FIX_MS = 30_000;

/** The pin has its fixed place in the left column. */
const PIN_KEY = 'act:point';
/** How long the pin stays pressed in after a touch. */
const PRESSED_MS = 1500;

function choices(): FunctionEntry[] {
  return [...MAP_ACTIONS, ...functionEntries()].filter(
    (entry) => entry.key !== PIN_KEY,
  );
}

/**
 * A pin where the boat is now: a point of the journal during a recording,
 * otherwise a mark of « Mes repères ».
 */
function pinHere(): void {
  if (state.view.tracking.value) {
    void trkPointNow();
    return;
  }
  const fix = state.view.lastFix.value;
  if (fix?.at && Date.now() - Date.parse(fix.at) < FRESH_FIX_MS) {
    markAt(fix.lat, fix.lon);
    return;
  }
  toast('📌 Lecture de la position GPS…');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => markAt(coords.latitude, coords.longitude),
    () => toast('📌 Pas de position GPS : la marque n’est pas enregistrée.'),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
  );
}

function markAt(lat: number, lon: number): void {
  const mark = addMark(lat, lon);
  toast(`📌 ${mark.name} enregistrée à la position du bateau`);
}

function run(key: string): void {
  buzz();
  const map = tracker.current?.map ?? shownMap();
  if (key === 'act:zoomin') {
    map?.zoomIn();
    return;
  }
  if (key === 'act:zoomout') {
    map?.zoomOut();
    return;
  }
  if (key === 'act:point') {
    pinHere();
    return;
  }
  if (key === 'act:photo') {
    if (state.data.cruise.value) takePhoto('nav', undefined, undefined, true);
    else toast('Photo : ouvrez d’abord une sortie (PréP), elle y sera rangée.');
    return;
  }
  if (key === 'act:locate') {
    document.querySelector<HTMLElement>('.map-locate-btn')?.click();
    return;
  }
  go(key);
}

/**
 * The column of the landscape tablet, on the left of the map, top to bottom:
 * the clock, the arrow of the boat with ＋ at its right (3 s after the
 * arrow), NavIn, START (and Amarrage at its right during a track), the mark,
 * the dividers, the photo, and SOS at the very bottom; the magnifier alone
 * at the top right. NavIn unrolls at its right PréP (Météo during a
 * track), data, the settings and the phone or the VHF.
 * @returns The column, or nothing on a phone held upright.
 */
export function SideRails() {
  const wide = useWide();
  if (!wide) return null;
  return (
    <>
      <div className="side-rail side-rail-left">
        <div className="rail-line">
          <BoatButton />
          <PlusButton />
        </div>
        <div className="rail-navin-place" aria-hidden="true" />
        <StartLine />
        <PinButton />
        <RulerButton />
        <PhotoButton />
      </div>
      <NavinRow />
    </>
  );
}

/**
 * The row NavIn unrolls at its right: PréP (Météo during a track), then data
 * and the settings (their own buttons, placed there), then the phone or the
 * VHF. Leaving one of their menus rolls it back.
 * @returns The row, or nothing while rolled.
 */
function NavinRow() {
  useSignals();
  if (!navinRowOpen.value) return null;
  const tracking = state.view.tracking.value;
  const weather = choices().find((entry) => entry.key === 'weather');
  return (
    <div className="navin-row" onClickCapture={navinRowChosen}>
      <div className="navin-row-first">
        {tracking && weather ? (
          <RailButton entry={weather} onPick={noPick} />
        ) : (
          <PrepButton />
        )}
      </div>
      <div className="navin-row-comm">
        <CommButton />
      </div>
    </div>
  );
}

/** ＋ is shown this long after a touch on the arrow, or on itself. */
const PLUS_MS = 3000;

/** ＋ is shown (for a moment after the arrow). */
const plusShown = signal(false);
let plusTimer: ReturnType<typeof setTimeout> | undefined;

function showPlus(): void {
  plusShown.value = true;
  clearTimeout(plusTimer);
  plusTimer = setTimeout(() => {
    plusShown.value = false;
  }, PLUS_MS);
}

/**
 * ＋ at the right of the arrow: zooms in the map shown, one level. It shows
 * for 3 s after a touch on the arrow (each ＋ gives 3 s more), on a map only.
 * @returns The button, or nothing.
 */
function PlusButton() {
  useSignals();
  const tr = useTr();
  const map = state.view.currentView.value === 'tracker' || shownMap();
  if (!map || !plusShown.value) return null;
  return (
    <Button
      type="button"
      noUiEdit
      className="rail-btn rail-zoom-in"
      aria-label={tr('Zoomer')}
      onClick={() => {
        showPlus();
        zoom(1);
      }}
    >
      <span className="rail-icon">
        <ZoomSign plus />
      </span>
    </Button>
  );
}

/**
 * The photo, at its fixed place under the dividers.
 * @returns The button.
 */
function PhotoButton() {
  const tr = useTr();
  return (
    <Button
      type="button"
      noUiEdit
      className="rail-btn rail-bare rail-photo"
      aria-label={tr('Photo')}
      onClick={() => run('act:photo')}
    >
      <span className="rail-icon">
        <RailIcon name="act:photo" />
      </span>
    </Button>
  );
}

/**
 * Zoom the map shown one level. Away from a map, the map opens.
 * @param step - In or out.
 */
function zoom(step: 1 | -1): void {
  buzz();
  const map = tracker.current?.map ?? shownMap();
  if (!map || !document.contains(map.getContainer())) {
    go('tracker');
    return;
  }
  if (step > 0) map.zoomIn();
  else map.zoomOut();
}

function ZoomSign({ plus }: { plus: boolean }) {
  return (
    <svg className="rail-zoom-sign" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={plus ? 'M12 4v16M4 12h16' : 'M4 12h16'}
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function noPick(): void {
  // The fixed places of the left column are not chosen.
}

/** Functions shown with a drawing rather than their emoji. */
const DRAWN = new Set(['act:point', 'act:photo', 'weather']);

/** The arrow of the boat button. */
/** Course up: the arrow straight up, in the middle of the button. */
const BOAT_UP_SVG =
  '<svg class="rail-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19.5 21 12 17 4.5 21z" fill="currentColor"/></svg>';
const BOAT_SVG =
  '<svg class="rail-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3 10.5l7.5 3 3 7.5z" fill="currentColor"/></svg>';

/**
 * Under the clock: the arrow of the boat, with a small − at its right. The
 * first touch brings the map back on the boat, each further touch zooms out;
 * a long press turns the map to the course of the boat, the arrow red, and
 * back to north up, blue.
 * @returns The button.
 */
function BoatButton() {
  const tr = useTr();
  const [courseUp, setCourseUp] = useState(() => mapOrientation() === 'course');
  const press = useLongPress(() => setCourseUp(boatOrientPress()));
  const classes = ['rail-btn', 'rail-bare', 'rail-boat'];
  if (courseUp) classes.push('course-up');
  if (press.hit) classes.push('lp-hit');
  return (
    <Button
      type="button"
      noUiEdit
      className={classes.join(' ')}
      aria-label={tr(
        courseUp
          ? 'Bateau · cap en haut · appui long : nord en haut'
          : 'Bateau · appui long : cap en haut',
      )}
      aria-pressed={courseUp}
      onClick={() => {
        boatArrowTap();
        showPlus();
      }}
      {...press.handlers}
    >
      <span className="rail-icon">
        {markupToReact(courseUp ? BOAT_UP_SVG : BOAT_SVG)}
      </span>
      <span className="rail-minus" aria-hidden="true">
        −
      </span>
    </Button>
  );
}

/**
 * Last fixed button of the left column, as low as the magnifier: a pin where
 * the boat is. Touched, it stays pressed in a moment, as a real button.
 * @returns The button.
 */
function PinButton() {
  useSignals();
  const tr = useTr();
  const [pressed, setPressed] = useState(0);
  // A long press opens « Mes marques ».
  const press = useLongPress(() => {
    buzz();
    go('marks');
  });
  const here = state.view.currentView.value === 'marks';
  useEffect(() => {
    if (!pressed) return undefined;
    const timer = setTimeout(() => setPressed(0), PRESSED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pressed]);
  return (
    <Button
      type="button"
      noUiEdit
      className={[
        'rail-btn rail-bare rail-pin',
        pressed ? 'rail-pressed' : '',
        here ? 'menu-here' : '',
        press.hit ? 'lp-hit' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={tr('Point ici · appui long : mes marques')}
      aria-pressed={pressed > 0}
      onClick={() => {
        setPressed(Date.now());
        run(PIN_KEY);
      }}
      {...press.handlers}
    >
      <span className="rail-icon">
        <RailIcon name={PIN_KEY} />
      </span>
    </Button>
  );
}

/** Time for the map to open before the dividers are laid on it. */
const MAP_OPEN_MS = 600;

function rulerButton(): HTMLElement | null {
  const map = shownMap() ?? tracker.current?.map;
  const box = map?.getContainer();
  return box?.isConnected && box.offsetParent !== null
    ? box.querySelector<HTMLElement>('.ruler-btn')
    : null;
}

/** The dividers on the map shown, or on the map of the boat. */
function toggleRuler(): void {
  const button = rulerButton();
  if (button) {
    button.click();
    return;
  }
  buzz();
  go('tracker');
  setTimeout(() => rulerButton()?.click(), MAP_OPEN_MS);
}

/**
 * The dividers, distance and course, at their fixed place in the right
 * column: lit while laid on the map.
 * @returns The button.
 */
function RulerButton() {
  useSignals();
  const tr = useTr();
  const on = rulerOn.value;
  // A long press turns the arrow about.
  const press = useLongPress(() => {
    if (!flipRuler()) toast('Touchez le compas pour le poser sur la carte.');
  });
  const classes = ['rail-btn', 'rail-bare', 'rail-ruler'];
  if (on) classes.push('rail-on');
  if (press.hit) classes.push('lp-hit');
  return (
    <Button
      type="button"
      noUiEdit
      className={classes.join(' ')}
      aria-label={tr(
        'Compas : distance et cap · appui long : inverser la flèche',
      )}
      aria-pressed={on}
      onClick={toggleRuler}
      {...press.handlers}
    >
      <span className="rail-icon">{markupToReact(DIVIDERS_ICON)}</span>
    </Button>
  );
}

function openCalls(zone: 'ext' | 'int'): void {
  buzz();
  go('vhf', zone);
}

/**
 * PréP, first of the row of NavIn: it opens the preparation.
 * @returns The button.
 */
function PrepButton() {
  useSignals();
  const tr = useTr();
  const prepOn = state.data.prep.value !== null;
  const inPrep =
    prepOn &&
    (state.view.currentView.value === 'prep' || hasBodyClass('prep-on'));
  const classes = ['rail-btn', 'rail-prep'];
  if (inPrep) classes.push('rail-on');
  else if (prepOn) classes.push('prep-held', 'menu-here');
  const ready = state.data.prep.value === null ? prepReady.value : null;
  if (ready) classes.push('prep-ready', `prep-ready-${ready}`);
  return (
    <Button
      type="button"
      noUiEdit
      className={classes.join(' ')}
      aria-label={tr(prepOn ? 'PréP en cours' : 'PréP')}
      aria-pressed={prepOn}
      onClick={() => {
        buzz();
        domainActions.prepStart();
      }}
    >
      <span className="rail-icon">
        {markupToReact(inPrep ? FLAG_WAVE_SVG : FLAG_SVG)}
      </span>
    </Button>
  );
}

/**
 * START under NavIn: a short touch starts the track, then the button holds
 * every step of it; during a track Amarrage stands at its right.
 * @returns The line.
 */
function StartLine() {
  useSignals();
  const tr = useTr();
  const tracking = state.view.tracking.value;
  let start = (
    <Button
      type="button"
      noUiEdit
      className="rail-btn rail-start"
      aria-label={tr('START : démarrer la trace')}
      onClick={() => {
        buzz();
        domainActions.quickStart();
      }}
    >
      <span className="rail-icon">{markupToReact(START_SVG)}</span>
    </Button>
  );
  if (tracking) start = <TrackRailButton />;
  else if (trackDone.value) start = <TrackDoneButton />;
  return (
    <div className="rail-line rail-depart">
      {start}
      {tracking ? (
        <Button
          type="button"
          noUiEdit
          className="rail-btn rail-bare rail-moor"
          aria-label={tr('Amarrage : fin de la trace, puis check-out')}
          onClick={() => {
            buzz();
            domainActions.moorNow();
          }}
        >
          <span className="rail-icon">{markupToReact(MOOR_SVG)}</span>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Last of the row of NavIn: at sea the VHF, a long press opens the phone
 * numbers (the handset then takes the button, the VHF goes small, and a long
 * press goes back); on a lake the phone.
 * @returns The button.
 */
function CommButton() {
  useSignals();
  const tr = useTr();
  const lake = navZone() === 'lac';
  const inCalls = state.view.currentView.value === 'vhf';
  // At sea, the phone numbers opened by a long press: the handset takes the
  // button, the VHF goes small; leaving the menu brings the VHF back.
  const phones = inCalls && state.view.viewArg.value === 'int';
  const press = useLongPress(() => openCalls(phones ? 'ext' : 'int'));
  const here = inCalls ? ' menu-here' : '';
  if (lake) {
    return (
      <Button
        type="button"
        noUiEdit
        className={`rail-btn rail-comm${here}`}
        aria-label={tr('Téléphone')}
        onClick={() => openCalls('int')}
      >
        <span className="rail-icon">
          <RailIcon name="phone" />
        </span>
      </Button>
    );
  }
  const [big, small] = phones ? ['phone', 'vhf'] : ['vhf', 'phone'];
  return (
    <Button
      type="button"
      noUiEdit
      className={`rail-btn rail-comm${here}${press.hit ? ' lp-hit' : ''}`}
      aria-label={tr(
        phones
          ? 'Téléphone · appui long : VHF'
          : 'VHF · appui long : téléphone',
      )}
      onClick={() => openCalls(phones ? 'int' : 'ext')}
      {...press.handlers}
    >
      <span className="rail-icon">
        <RailIcon name={big} />
      </span>
      <span className="rail-badge" aria-hidden="true">
        <RailIcon name={small} />
      </span>
    </Button>
  );
}

function RailButton({
  entry,
  onPick,
}: {
  entry: FunctionEntry;
  onPick: () => void;
}) {
  useSignals();
  const tr = useTr();
  const press = useLongPress(onPick);
  // Météo stays Météo during a track: Live météo is inside its menu.
  const shown = entry;
  const { icon, label } = splitTitle(shown.title);
  const drawn = DRAWN.has(shown.key);
  // A clear drawing speaks for itself: no word under it.
  const bare = drawn;
  const classes = ['rail-btn'];
  if (bare) classes.push('rail-bare');
  // Its menu is open: the button blinks yellow, as PréP.
  const weather = shown.key === 'weather';
  if (
    state.view.currentView.value === shown.key ||
    (weather && inMenu('weather'))
  ) {
    classes.push('menu-here');
  }
  // The weather check, as PréP: orange blinking while started, green once
  // every point is ticked (for the day).
  const check = weather
    ? wxCheckState(isLake() || navZone() === 'lac')
    : 'none';
  if (check === 'ok') classes.push('prep-ready', 'prep-ready-ok');
  if (check === 'part') classes.push('prep-held', 'menu-here');
  if (press.hit) classes.push('lp-hit');
  return (
    <Button
      type="button"
      noUiEdit
      className={classes.join(' ')}
      aria-label={bare ? tr(label) : undefined}
      onClick={() => {
        if (!weather) {
          run(shown.key);
          return;
        }
        // Météo is a menu button: one step back inside, then out.
        menuButtonPress(
          'weather',
          navBack,
          () => run('weather'),
          () =>
            state.view.currentView.value === 'weather' &&
            state.view.viewArg.value !== 'forecast',
        );
      }}
      {...press.handlers}
    >
      <span className="rail-icon">
        {drawn ? <RailIcon name={shown.key} /> : icon || '•'}
      </span>
      {bare ? null : <span className="rail-label">{tr(label)}</span>}
    </Button>
  );
}
