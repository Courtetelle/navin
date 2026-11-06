import { signal } from '@preact/signals-react';

import { findStartPlace } from '../../features/onwater/index.ts';
import type { ModeKey } from '../../model/modes.ts';
import { MODES } from '../../model/modes.ts';
import type { Cruise } from '../../model/types.ts';
import { curMode, state } from '../../state/index.ts';

/** Time between two searches of the place of departure. */
const PLACE_SEARCH_DELAY = 600_000;

/** Boat chosen for a new lake outing. */
export const newBoat = signal<string | null>(null);
/** Sea area chosen for a new cruise. */
export const newZone = signal<string | null>(null);
/** Place of departure: `undefined` before the first search, null while searching. */
export const newPlace = signal<string | null | undefined>(undefined);
/** Text of the `#newPlace` field. */
export const placeText = signal('');
/** Text typed in the `#newName` field. */
export const nameText = signal('');
/** The `#newPlace` field announces a GPS search. */
export const placeSearching = signal(false);
/** « Reprendre le bateau, les numéros et réglages » is on. */
export const keepBoat = signal(true);
/** « Reprendre l’équipage » is on. */
export const keepCrew = signal(false);
/**
 * The automatic name counts the boat taken over: the screen draws it before
 * the button exists, so only a change of the form brings the boat into it.
 */
export const nameWithKeptBoat = signal(false);

let placeAt = 0;
let placeBusy = false;

/**
 * Mode of the screen: the type asked, else the open cruise's, else the sea.
 * @param type - `state.view.newType`.
 * @returns A valid mode.
 */
export function resolveMode(type: string | null): ModeKey {
  const asked = type === 'lac' ? 'lacj' : type;
  if (asked && asked in MODES) return asked as ModeKey;
  return state.data.cruise.value ? curMode() : 'mer';
}

/**
 * Sea area of a new cruise (chosen, else the last used, else Mediterranean).
 * @returns The zone code.
 */
export function zoneNow(): string {
  const { lastZone } = state.preferences.settings.value;
  return newZone.value || (lastZone as string | undefined) || 'M';
}

/**
 * Boat name the automatic name takes from the open cruise.
 * @param cruise - Cruise whose boat is taken over, if any.
 * @param counted - The name already counts it.
 * @returns The name, `''` when not counted.
 */
export function keptBoatName(cruise: Cruise | null, counted: boolean): string {
  if (!counted || !cruise || cruise.type === 'lac') return '';
  return cruise.info.boat || '';
}

/** Touch on the button of the boat taken over: the name follows from now on. */
export function toggleKeepBoat(): void {
  keepBoat.value = !keepBoat.peek();
  nameWithKeptBoat.value = true;
}

/** Touch on the button of the crew taken over. */
export function toggleKeepCrew(): void {
  keepCrew.value = !keepCrew.peek();
}

/**
 * Prepare the fields when the screen opens: coming back to it from elsewhere,
 * the typed name is gone; a redraw of the same screen keeps what is typed.
 * @param redrawn - The screen was already shown.
 * @param keepBoatShown - That screen showed the button of the boat taken over.
 */
export function enterForm(redrawn: boolean, keepBoatShown: boolean): void {
  if (redrawn) {
    redrawForm(keepBoatShown);
    return;
  }
  nameText.value = '';
  placeText.value = newPlace.peek() ?? '';
  placeSearching.value = newPlace.peek() === null;
  keepBoat.value = true;
  keepCrew.value = false;
  nameWithKeptBoat.value = false;
}

/**
 * The screen is drawn again: the place typed becomes the place of the form,
 * the two take-over buttons go back to their first state.
 * @param keepBoatShown - The button of the boat taken over was on screen.
 */
export function redrawForm(keepBoatShown: boolean): void {
  const place = placeText.peek().trim();
  newPlace.value = place;
  placeText.value = place;
  placeSearching.value = false;
  nameWithKeptBoat.value = keepBoatShown && keepBoat.peek();
  keepBoat.value = true;
  keepCrew.value = false;
}

/**
 * Look for the place of departure, at most every 10 minutes (legacy end of
 * `VIEWS.cruises`).
 * @param mode - Mode shown.
 */
export function searchPlace(mode: ModeKey): void {
  const stale = Date.now() - placeAt > PLACE_SEARCH_DELAY;
  if (placeBusy || !(newPlace.peek() === undefined || stale)) return;
  placeBusy = true;
  if (!newPlace.peek()) newPlace.value = null;
  findStartPlace(mode, (place, zone) => {
    placeBusy = false;
    placeAt = Date.now();
    const shown = state.view.currentView.peek() === 'cruises';
    const typed = shown ? placeText.peek().trim() : '';
    newPlace.value = typed || place || '';
    if (zone && !newZone.peek() && mode === 'mer' && zone !== 'X') {
      newZone.value = zone;
    }
    if (!shown) return;
    if (!placeText.peek()) placeText.value = newPlace.peek() ?? '';
    placeSearching.value = false;
    nameWithKeptBoat.value = true;
  });
}
