import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import {
  boatById,
  lastTripKey,
  noteUse,
  openCruise,
  setPrep,
  state,
  toast,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';
import { startTracking } from '../tracking/index.ts';

import { navPageRefresh } from './navPage.ts';
import { applyCrewSet } from './prepCrew.ts';
import { prepCreateOrFill } from './prepCruise.ts';
import { prepGo } from './prepFlow.ts';
import { PREP_PATH_KEYS, prepPathDrop, prepPathGet } from './prepPaths.ts';
import type { PrepTarif } from './prepTarif.ts';
import { prepTarifApply, prepTarifs } from './prepTarif.ts';
import { prepFlow, updatePrepFlow } from './prepTypes.ts';

/**
 * A lake path chosen: resumed as it was left, or started from scratch.
 * @param purpose - `Entraînement`, `Location` or `Invitation`.
 */
export function pickPurpose(purpose: string): void {
  buzz();
  const path = prepPathGet(purpose);
  updatePrepFlow((prep) => {
    const { type } = prep;
    for (const key of PREP_PATH_KEYS) Reflect.deleteProperty(prep, key);
    prep.purpose = purpose;
    prep.type = type;
    prep.sub = null;
    prep.crewDraft = null;
    prep.newCrew = false;
    if (path) {
      Object.assign(prep, path);
      Reflect.deleteProperty(prep, 't');
    } else {
      prep.duree = 'jour';
      prep.fresh = true;
      prep.reach = 0;
    }
  });
  if (!path) {
    prepGo(2);
    return;
  }
  if (
    path.cruiseId &&
    state.data.cruise.value?.id !== path.cruiseId &&
    !state.view.tracking.value
  ) {
    openCruise(path.cruiseId);
    navPageRefresh();
  }
  prepGo(Math.max(2, path.reach ?? 2), true);
}

/**
 * Duration chosen.
 * @param duree - `jour` or `croisiere`.
 */
export function pickDuree(duree: string): void {
  buzz();
  updatePrepFlow((prep) => {
    prep.duree = duree;
  });
  prepGo(2);
}

/**
 * Boat chosen: the navigation opens; a rental then shows the fares.
 * @param boatId - Boat.
 */
export function pickBoat(boatId: string): void {
  buzz();
  updatePrepFlow((prep) => {
    prep.boatId = boatId;
  });
  prepCreateOrFill();
  const prep = prepFlow();
  noteUse('boat', boatId, prep?.purpose ?? undefined);
  if (prep?.purpose === 'Location' && prep.type === 'lac') {
    updatePrepFlow((flow) => {
      flow.tarif = null;
      flow.sub = 'tarif';
    });
    prepGo(2);
    return;
  }
  prepGo(3);
}

/**
 * Composition chosen: taken as it is.
 * @param setId - Composition.
 */
export function pickCrewSet(setId: string): void {
  buzz();
  updatePrepFlow((prep) => {
    prep.crewSet = setId;
  });
  const set = state.data.crewSets.value.find((item) => item.id === setId);
  if (!set || !applyCrewSet(set)) return;
  noteUse('crew', set.id, prepFlow()?.purpose ?? undefined);
  updatePrepFlow((prep) => {
    prep.sub = null;
    prep.crewDraft = null;
  });
  prepGo(4);
}

/**
 * Fare chosen.
 * @param position - Line of the fare, or null for no fare.
 */
export function pickTarif(position: number | null): void {
  buzz();
  const boat = boatById(prepFlow()?.boatId);
  const tarif: PrepTarif | null | undefined =
    position === null ? null : prepTarifs(boat)[position];
  prepTarifApply(tarif);
  toast(
    tarif
      ? `Tarif : ${tarif.label}${tarif.chf ? ` · CHF ${tarif.chf}` : ''}`
      : 'Sans tarif',
  );
  updatePrepFlow((prep) => {
    prep.sub = null;
  });
  prepGo(3);
}

/** « Départ »: the path sails off, the track and the automatic logbook start. */
export function prepDepart(): void {
  buzz();
  prepPathDrop(prepFlow()?.purpose);
  setPrep(null);
  store.del(lastTripKey());
  go('tracker');
  startTracking(false);
  navPageRefresh();
}
