import { dayKey } from '../../lib/format.ts';
import { LAKE_CONTACTS } from '../../model/contacts.ts';
import type { Boat, Cruise } from '../../model/types.ts';
import {
  blankCruise,
  blankOuting,
  boatById,
  saveCruise,
  setCruise,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';
import { autoOutingName } from '../onwater/index.ts';
import { stopTracking } from '../tracking/index.ts';

import type { PrepFlow } from './prepTypes.ts';
import { prepFlow, updatePrepFlow } from './prepTypes.ts';

/**
 * Create and open a new outing or cruise (legacy `newNavCruise`).
 * @param mode - `lacj`, `lacc` or `mer`.
 * @param boat - Lake boat, if any.
 * @param boatName - Name of the sea boat.
 * @param quick - Started by a long press, to complete later with the PréP.
 * @returns The new cruise.
 */
export function newNavCruise(
  mode: string,
  boat: Boat | null | undefined,
  boatName: string,
  quick: boolean,
): Cruise {
  const lake = mode !== 'mer';
  const zone = lake
    ? 'L'
    : (state.preferences.settings.value.lastZone as string | undefined) || 'M';
  const name = autoOutingName(
    mode,
    lake ? (boat ? boat.info.boat || '' : '') : boatName || '',
    '',
    zone,
  );
  if (state.view.tracking.value) void stopTracking(false);
  const duree = mode === 'lacc' ? 'croisiere' : 'jour';
  let cruise: Cruise;
  if (lake && boat) {
    cruise = blankOuting(name, boat, duree);
  } else if (lake) {
    cruise = blankCruise(name, null);
    cruise.type = 'lac';
    cruise.duree = duree;
    Object.assign(cruise, { boatId: null });
    Object.assign(cruise.info, {
      contacts: LAKE_CONTACTS,
      du: dayKey(new Date()),
    });
  } else {
    cruise = blankCruise(name, null);
    cruise.zone = zone;
    if (boatName) cruise.info.boat = boatName;
  }
  if (mode === 'lacj') {
    cruise.purpose = state.view.newPurpose.value || 'Entraînement';
  }
  if (quick) cruise.quick = true;
  setCruise(cruise);
  saveCruise();
  return cruise;
}

/**
 * The kind of navigation the PréP is preparing (legacy `prepMode`).
 * @param prep - PréP flow.
 * @returns `lacj`, `lacc` or `mer`.
 */
export function prepMode(prep: Pick<PrepFlow, 'type' | 'duree'>): string {
  if (prep.type === 'mer') return 'mer';
  return prep.duree === 'croisiere' ? 'lacc' : 'lacj';
}

/**
 * Open the navigation of the PréP, or complete the one started by a long press
 * (legacy `prepCreateOrFill`).
 */
export function prepCreateOrFill(): void {
  const prep = prepFlow();
  if (!prep) return;
  const mode = prepMode(prep);
  const boat = prep.boatId ? boatById(prep.boatId) : null;
  if (prep.fill && state.data.cruise.value?.quick) {
    completeQuickCruise(prep, mode, boat);
    toast('Navigation complétée');
  } else {
    const cruise = newNavCruise(mode, boat, prep.boatName ?? '', false);
    toast(
      `${mode === 'lacj' ? 'Sortie' : 'Croisière'} « ${cruise.info.name} » ouverte`,
    );
  }
  if (prep.type === 'lac' && prep.purpose) {
    const { purpose } = prep;
    updateCruise((cruise) => {
      cruise.purpose = purpose;
    });
  }
  const cruiseId = state.data.cruise.value?.id;
  updatePrepFlow((flow) => {
    flow.cruiseId = cruiseId;
  });
}

function completeQuickCruise(
  prep: PrepFlow,
  mode: string,
  boat: Boat | null | undefined,
): void {
  updateCruise((cruise) => {
    if (mode === 'mer') {
      cruise.type = 'mer';
      Reflect.deleteProperty(cruise, 'duree');
      Reflect.deleteProperty(cruise, 'boatId');
      if (prep.boatName) cruise.info.boat = prep.boatName;
    } else {
      cruise.type = 'lac';
      cruise.duree = mode === 'lacc' ? 'croisiere' : 'jour';
      if (boat && cruise.boatId !== boat.id) {
        cruise.boatId = boat.id;
        Object.assign(cruise.info, structuredClone(boat.info), {
          name: cruise.info.name,
        });
      }
    }
    Reflect.deleteProperty(cruise, 'quick');
  });
}
