import { buzz } from '../../lib/dom.ts';
import type { ModeKey } from '../../model/modes.ts';
import type { Boat, Cruise } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import {
  blankCruise,
  blankOuting,
  hooks,
  saveCruise,
  setCruise,
  state,
  toast,
  updateSettings,
} from '../../state/index.ts';

import { keepCrew, newPlace, placeText } from './newCruiseForm.ts';

/** What the form of a new navigation decided. */
interface NewCruiseChoices {
  /** Mode of the navigation. */
  mode: ModeKey;
  /** Boat of a lake outing. */
  boat: Boat | undefined;
  /** Name typed, else the automatic one. */
  name: string;
  /** Sea area. */
  zone: string;
  /** Cruise whose boat, numbers and settings are taken over. */
  fromCruise: Cruise | null;
}

/**
 * Create a navigation, open it and go to its first screen (legacy `#createBtn`).
 * @param choices - The form.
 * @returns `false` when the name is missing: the form then focuses its field.
 */
export function createCruise({
  mode,
  boat,
  name,
  zone,
  fromCruise,
}: NewCruiseChoices): boolean {
  buzz();
  const lake = mode !== 'mer';
  if (lake && !boat) {
    toast('Choisissez ou ajoutez un bateau');
    return true;
  }
  if (!name) {
    toast('Donnez un nom à la croisière');
    return false;
  }
  if (state.view.tracking.value) void hooks.stopTracking?.(false);
  const cruise = state.data.cruise.value;
  const created =
    lake && boat
      ? blankOuting(name, boat, mode === 'lacc' ? 'croisiere' : 'jour')
      : blankCruise(name, fromCruise);
  if (mode === 'lacj') created.purpose = state.view.newPurpose.value;
  if (mode === 'mer') {
    created.zone = zone;
    updateSettings((settings) => {
      settings.lastZone = zone;
    });
  }
  const place = placeText.value.trim();
  if (place && !created.info.ports) created.info.ports = place;
  newPlace.value = undefined;
  state.view.nameDirty.value = false;
  if (keepCrew.value && cruise) created.crew = structuredClone(cruise.crew);
  setCruise(created);
  saveCruise();
  toast(`${mode === 'lacj' ? 'Sortie' : 'Croisière'} « ${name} » ouverte`);
  go(lake ? 'checklist' : 'info');
  return true;
}
