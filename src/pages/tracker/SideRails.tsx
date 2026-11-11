import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { shownMap } from '../../features/map/mapFull.ts';
import { mapOrientation } from '../../features/map/mapOrientation.ts';
import {
  boatOrientPress,
  boatScaleTap,
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
import { go } from '../../shell/router.ts';
import type { FunctionEntry } from '../../shell/search/searchIndex.ts';
import { functionEntries } from '../../shell/search/searchIndex.ts';
import { domainActions } from '../../shell/topbar/tabDisplays.ts';
import {
  FLAG_SVG,
  FLAG_WAVE_SVG,
  START_SVG,
} from '../../shell/topbar/tabIcons.ts';
import { addMark, navZone, state, toast } from '../../state/index.ts';

import { TrackRailButton } from './TrackRailButton.tsx';
import { RailIcon } from './railIcons.tsx';
import type { RailSide, Rails } from './sideRails.ts';
import { MAP_ACTIONS, loadRails, setRail, splitTitle } from './sideRails.ts';

/** A GPS position older than this is read again. */
const FRESH_FIX_MS = 30_000;

/** A place being chosen: its column and its rank. */
interface Picking {
  side: RailSide;
  index: number;
}

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
 * Two columns of buttons beside the map, on a landscape tablet only. A free
 * place (＋) takes any function of the app; a long press on a button changes
 * or removes it. The choice stays on this device.
 * @returns The columns, or nothing on a phone.
 */
export function SideRails() {
  const wide = useWide();
  const [rails, setRails] = useState<Rails>(loadRails);
  const [picking, setPicking] = useState<Picking | null>(null);
  if (!wide) return null;
  const known = new Map(choices().map((entry) => [entry.key, entry]));
  const pick = (key: string) => {
    if (!picking) return;
    buzz();
    setRails(setRail(rails, picking.side, picking.index, key));
    setPicking(null);
  };
  return (
    <>
      {(['left', 'right'] as const).map((side) => (
        <div key={side} className={`side-rail side-rail-${side}`}>
          {side === 'left' ? (
            <>
              <BoatButton />
              <DepartButtons />
              <PinButton />
            </>
          ) : null}
          {side === 'right' ? (
            <>
              <CommButton />
              <RulerButton />
            </>
          ) : null}
          {rails[side].slice(0, slotsOf(side)).map((key, index) => {
            const entry = key ? known.get(key) : undefined;
            return entry ? (
              <RailButton
                // eslint-disable-next-line react/no-array-index-key -- the places are fixed
                key={index}
                entry={entry}
                onPick={() => {
                  buzz();
                  setPicking({ side, index });
                }}
              />
            ) : null;
          })}
        </div>
      ))}
      {picking ? (
        <RailPicker
          current={rails[picking.side][picking.index] ?? ''}
          onPick={pick}
          onAdd={addPlaceOf(rails, picking.side)}
          onMove={(index) => setPicking({ side: picking.side, index })}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </>
  );
}

/** Functions shown with a drawing rather than their emoji. */
const DRAWN = new Set(['act:point', 'act:photo', 'weather']);

/**
 * Places left for the sailor's buttons: the right column has NavIn, the
 * magnifier, VHF / phone and data first, the left one the boat, Météo, PréP,
 * START and the pin.
 */
function slotsOf(side: RailSide): number {
  return side === 'right' ? RIGHT_SLOTS : LEFT_SLOTS;
}

const RIGHT_SLOTS = 3;

const LEFT_SLOTS = 3;

/** The arrow of the boat button. */
/** Course up: the arrow straight up, in the middle of the button. */
const BOAT_UP_SVG =
  '<svg class="rail-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19.5 21 12 17 4.5 21z" fill="currentColor"/></svg>';
const BOAT_SVG =
  '<svg class="rail-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3 10.5l7.5 3 3 7.5z" fill="currentColor"/></svg>';

/**
 * First of the left column, in the place NavIn had: the boat. Each touch
 * shows the boat at the next scale and follows it; a long press turns the
 * map to the course of the boat, the button red, and back to north up.
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
      onClick={boatScaleTap}
      {...press.handlers}
    >
      <span className="rail-icon">
        {markupToReact(courseUp ? BOAT_UP_SVG : BOAT_SVG)}
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
  const tr = useTr();
  const [pressed, setPressed] = useState(0);
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
      className={
        pressed
          ? 'rail-btn rail-bare rail-pin rail-pressed'
          : 'rail-btn rail-bare rail-pin'
      }
      aria-label={tr('Point ici')}
      aria-pressed={pressed > 0}
      onClick={() => {
        setPressed(Date.now());
        run(PIN_KEY);
      }}
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
 * First of the left column while no track is recorded: PréP opens the
 * preparation, a long press on START starts the track at once (a short touch
 * only says so, against a start by mistake).
 * @returns The two buttons, or nothing during a track.
 */
function DepartButtons() {
  useSignals();
  const tr = useTr();
  const start = useLongPress(() => {
    buzz();
    domainActions.quickStart();
  });
  const tracking = state.view.tracking.value;
  // A PréP under way shows on its own button, no longer on NavIn.
  const prepOn = state.data.prep.value !== null;
  const inPrep =
    prepOn &&
    (state.view.currentView.value === 'prep' || hasBodyClass('prep-on'));
  const prepClasses = ['rail-btn', 'rail-prep'];
  if (tracking) prepClasses.push('rail-hidden');
  if (prepOn) prepClasses.push('rail-on');
  return (
    <div className="rail-depart">
      <Button
        type="button"
        noUiEdit
        className={prepClasses.join(' ')}
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
      {tracking ? (
        <TrackRailButton />
      ) : (
        <Button
          type="button"
          noUiEdit
          className={
            start.hit ? 'rail-btn rail-start lp-hit' : 'rail-btn rail-start'
          }
          aria-label={tr('START : appui long pour démarrer la trace')}
          onClick={() => toast(tr('START : appui long pour démarrer la trace'))}
          {...start.handlers}
        >
          <span className="rail-icon">{markupToReact(START_SVG)}</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Always shown, first of the right column: at sea the VHF, a long press opens
 * the phone numbers; on a lake the phone.
 * @returns The button.
 */
function CommButton() {
  useSignals();
  const tr = useTr();
  const lake = navZone() === 'lac';
  const press = useLongPress(() => openCalls('int'));
  if (lake) {
    return (
      <Button
        type="button"
        noUiEdit
        className="rail-btn rail-comm"
        aria-label={tr('Téléphone')}
        onClick={() => openCalls('int')}
      >
        <span className="rail-icon">
          <RailIcon name="phone" />
        </span>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      noUiEdit
      className={press.hit ? 'rail-btn rail-comm lp-hit' : 'rail-btn rail-comm'}
      aria-label={tr('VHF · appui long : téléphone')}
      onClick={() => openCalls('ext')}
      {...press.handlers}
    >
      <span className="rail-icon">
        <RailIcon name="vhf" />
      </span>
      <span className="rail-badge" aria-hidden="true">
        <RailIcon name="phone" />
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
  // During a track, the Météo menu gives way to Live météo.
  const shown =
    entry.key === 'weather' && state.view.tracking.value
      ? (functionEntries().find((one) => one.key === 'meteo') ?? entry)
      : entry;
  const { icon, label } = splitTitle(shown.title);
  const drawn = DRAWN.has(shown.key);
  // A clear drawing speaks for itself: no word under it.
  const bare = drawn;
  const classes = ['rail-btn'];
  if (bare) classes.push('rail-bare');
  if (press.hit) classes.push('lp-hit');
  return (
    <Button
      type="button"
      noUiEdit
      className={classes.join(' ')}
      aria-label={bare ? tr(label) : undefined}
      onClick={() => run(shown.key)}
      {...press.handlers}
    >
      <span className="rail-icon">
        {drawn ? <RailIcon name={shown.key} /> : icon || '•'}
      </span>
      {bare ? null : <span className="rail-label">{tr(label)}</span>}
    </Button>
  );
}

function addPlaceOf(rails: Rails, side: RailSide): number {
  return rails[side].slice(0, slotsOf(side)).findIndex((key) => !key);
}

function RailPicker({
  current,
  onPick,
  onAdd,
  onMove,
  onClose,
}: {
  current: string;
  onPick: (key: string) => void;
  /** A free place of the column, -1 when it is full. */
  onAdd: number;
  /** Choose for another place of the column. */
  onMove: (index: number) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  return (
    <div className="rail-pick" role="dialog" aria-modal="true">
      <div className="rail-pick-box">
        <h2>{tr(current ? 'Changer ce bouton' : 'Ajouter un bouton')}</h2>
        <div className="rail-pick-list">
          {choices().map((entry) => (
            <Button
              type="button"
              noUiEdit
              key={entry.key}
              className={entry.key === current ? 'btn primary' : 'btn'}
              onClick={() => onPick(entry.key)}
            >
              {tr(entry.title)}
            </Button>
          ))}
        </div>
        <div className="row c2">
          {current ? (
            <Button
              type="button"
              noUiEdit
              className="btn danger"
              onClick={() => {
                onPick('');
                toast(tr('Bouton retiré : la place est libre.'));
              }}
            >
              {tr('Retirer ce bouton')}
            </Button>
          ) : null}
          {current && onAdd >= 0 ? (
            <Button
              type="button"
              noUiEdit
              className="btn"
              onClick={() => {
                buzz();
                onMove(onAdd);
              }}
            >
              {tr('＋ Ajouter un bouton dans cette colonne')}
            </Button>
          ) : null}
          <Button type="button" noUiEdit className="btn" onClick={onClose}>
            {tr('Fermer')}
          </Button>
        </div>
      </div>
    </div>
  );
}
