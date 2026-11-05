import { dayKey, fmtTime2, uid } from '../../lib/format.ts';
import type { EntryValues } from '../../model/types.ts';
import {
  addEntry,
  boatById,
  isLake,
  state,
  toast,
  updateBoat,
  updateCruise,
  updateDay,
} from '../../state/index.ts';

import { lakeFix } from './lakeFix.ts';
import { refreshLakeButtons } from './lakeRefresh.ts';
import { BLACK_EVT } from './lakeState.ts';

/**
 * Add a journal entry with the position of the moment and the speed of the
 * running track, tell it in a bubble and rebuild the box (legacy `note`).
 * @param values - Entry values.
 * @param message - Bubble text.
 * @param time - ISO time (now by default).
 */
export function noteLakeEvent(
  values: EntryValues,
  message: string,
  time?: string,
): void {
  lakeFix((position) => {
    const entry: EntryValues = { ...values };
    if (position) entry.pos = position;
    const trip = state.view.trip.value;
    if (trip && state.view.tracking.value) {
      if (trip.det.lastSog != null) entry.sog = trip.det.lastSog as number;
      if (trip.det.lastCog != null) entry.cog = trip.det.lastCog as number;
    }
    addEntry({
      id: uid(),
      t: time || new Date().toISOString(),
      v: entry,
    });
    toast(message);
    refreshLakeButtons();
  });
}

/**
 * Time of the last black water discharge: kept on the boat of a lake outing,
 * else on the cruise (legacy `blackOwner().noirVid`).
 * @returns ISO time, if any.
 */
export function lastBlackWater(): string | undefined {
  const cruise = state.data.cruise.value;
  const boat = isLake() ? boatById(cruise?.boatId) : undefined;
  return (boat ?? cruise)?.noirVid as string | undefined;
}

/** Note a black water discharge, only on a deliberate double touch. */
export function noteBlackWater(): void {
  const cruise = state.data.cruise.value;
  const time = new Date().toISOString();
  const boat = isLake() ? boatById(cruise?.boatId) : undefined;
  if (boat) {
    updateBoat(boat.id, (draft) => {
      draft.noirVid = time;
    });
  } else {
    updateCruise((draft) => {
      draft.noirVid = time;
    });
  }
  if (isLake()) {
    updateDay(
      dayKey(new Date()),
      (day) => {
        day.eauxNoires = 'OK';
      },
      { save: false },
    );
  }
  noteLakeEvent(
    { evt: [BLACK_EVT] },
    `🚽 Vidange des eaux noires notée à ${fmtTime2(new Date(time))}`,
    time,
  );
}
