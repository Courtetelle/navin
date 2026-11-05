import { buzz } from '../../lib/dom.ts';
import { dayKey, textOf } from '../../lib/format.ts';
import { modeOf } from '../../model/modes.ts';
import type { Boat, Cruise } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import {
  boatById,
  herePos,
  lastTripKey,
  openCruise,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';
import { inSwissArea, trkChooseStart } from '../map/index.ts';
import { startTracking } from '../tracking/index.ts';

import { navPageRefresh } from './navPage.ts';
import { newNavCruise } from './prepCruise.ts';

/**
 * Start a track at once (legacy `quickStart`): the outing of the day is
 * resumed; else the most recent navigation goes on (cruise) or gives its boat
 * and crew to a new outing; the PréP can complete it later.
 */
export function quickStart(): void {
  buzz();
  if (state.view.tracking.value) {
    toast('Trace déjà en cours');
    go('tracker');
    return;
  }
  const open = state.data.cruise.value;
  let message: string;
  if (usedToday(open)) {
    go('tracker');
    if (store.get(lastTripKey(), null)) {
      toast('Sortie du jour reprise : prolonger ou nouvelle trace ?');
      setTimeout(trkChooseStart, 60);
      return;
    }
    message = '⏺ Trace démarrée';
  } else {
    message = openNavigation(open);
    go('tracker');
  }
  store.del(lastTripKey());
  startTracking(false);
  navPageRefresh();
  toast(message);
}

function usedToday(cruise: Cruise | null): boolean {
  if (!cruise) return false;
  const today = dayKey(new Date());
  if (dayKey(new Date(cruise.created)) === today) return true;
  return (cruise.entries || []).some(
    (entry) => dayKey(new Date(entry.t)) === today,
  );
}

function openNavigation(open: Cruise | null): string {
  const last = open ?? latestCruise();
  const mode = last ? modeOf(last) : null;
  if (last && (mode === 'mer' || mode === 'lacc')) {
    if (open?.id !== last.id) openCruise(last.id);
    return `⏺ Trace du jour démarrée · ${state.data.cruise.value?.info.name}`;
  }
  if (last && mode === 'lacj') {
    const boat = boatById(last.boatId) ?? lastLakeBoat();
    const crew = structuredClone(last.crew || []);
    const { purpose } = last;
    state.view.newPurpose.value = purpose || state.view.newPurpose.value;
    newNavCruise('lacj', boat, '', true);
    updateCruise((cruise) => {
      cruise.crew = crew;
      if (purpose) cruise.purpose = purpose;
    });
    return '⏺ Trace démarrée · même bateau et même équipage que la dernière sortie';
  }
  const position = herePos();
  const lake = position ? inSwissArea(position) : true;
  newNavCruise(lake ? 'lacj' : 'mer', lake ? lastLakeBoat() : null, '', true);
  return '⏺ Trace démarrée · complétez bateau et équipage plus tard avec PréP';
}

function latestCruise(): Cruise | null {
  const [latest] = state.data.index.value.toSorted((first, second) =>
    textOf(second.updated || second.created).localeCompare(
      textOf(first.updated || first.created),
    ),
  );
  return latest
    ? store.get<Cruise | null>(`ldb.cruise.${latest.id}`, null)
    : null;
}

function lastLakeBoat(): Boat | null {
  const [latest] = state.data.index.value
    .filter((meta) => meta.type === 'lac')
    .toSorted((first, second) => second.created.localeCompare(first.created));
  const cruise = latest
    ? store.get<Cruise | null>(`ldb.cruise.${latest.id}`, null)
    : null;
  return (
    (cruise ? boatById(cruise.boatId) : undefined) ??
    state.data.boats.value[0] ??
    null
  );
}
