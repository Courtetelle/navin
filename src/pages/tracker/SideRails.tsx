import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { shownMap } from '../../features/map/mapFull.ts';
import { trkPointNow } from '../../features/map/trackerPoint.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { takePhoto } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { useWide } from '../../lib/useWide.ts';
import { go } from '../../shell/router.ts';
import type { FunctionEntry } from '../../shell/search/searchIndex.ts';
import { functionEntries } from '../../shell/search/searchIndex.ts';
import { addMark, navZone, state, toast } from '../../state/index.ts';

import { RailIcon } from './railIcons.tsx';
import type { RailSide, Rails } from './sideRails.ts';
import {
  MAP_ACTIONS,
  RAIL_SLOTS,
  loadRails,
  setRail,
  splitTitle,
} from './sideRails.ts';

/** A GPS position older than this is read again. */
const FRESH_FIX_MS = 30_000;

/** A place being chosen: its column and its rank. */
interface Picking {
  side: RailSide;
  index: number;
}

function choices(): FunctionEntry[] {
  return [...MAP_ACTIONS, ...functionEntries()];
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
          {side === 'right' ? <CommButton /> : null}
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

/** The right column gives its first place to the VHF / phone button. */
function slotsOf(side: RailSide): number {
  return side === 'right' ? RAIL_SLOTS - 1 : RAIL_SLOTS;
}

function openCalls(zone: 'ext' | 'int'): void {
  buzz();
  go('vhf', zone);
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
        onClick={() => openCalls('int')}
      >
        <span className="rail-icon">
          <RailIcon name="phone" />
        </span>
        <span className="rail-label">{tr('Téléphone')}</span>
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
      <span className="rail-label">{tr('VHF')}</span>
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
  const drawn = entry.key === 'act:point' || entry.key === 'act:photo';
  return (
    <Button
      type="button"
      noUiEdit
      className={press.hit ? 'rail-btn lp-hit' : 'rail-btn'}
      onClick={() => run(shown.key)}
      {...press.handlers}
    >
      <span className="rail-icon">
        {drawn ? <RailIcon name={entry.key} /> : icon || '•'}
      </span>
      <span className="rail-label">{tr(label)}</span>
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
