import { num, uid } from '../../lib/format.ts';
import { NAV_KEYS } from '../../model/fields.ts';
import type { Entry } from '../../model/types.ts';
import {
  addEntry,
  carriedValues,
  saveCruise,
  state,
} from '../../state/index.ts';

import type { TrackEvent } from './detector.ts';
import { enrichEntry } from './weather.ts';

/**
 * Log reading of the last entry at or before a time (legacy `lochBefore`).
 * @param time - ISO time.
 * @returns The reading, 0 when there is none.
 */
export function lochBefore(time: string): number {
  const entries = state.data.cruise.value?.entries ?? [];
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (!entry || entry.t > time) continue;
    const loch = num(entry.v.loch);
    if (loch !== null) return loch;
  }
  return 0;
}

/**
 * Logbook entry of a key point (legacy `autoEntryFrom`).
 * @param event - Key point.
 * @param lochBase - Log reading at the start of the track.
 * @returns A new entry, not added yet.
 */
export function autoEntryFrom(event: TrackEvent, lochBase: number): Entry {
  const values = carriedValues(NAV_KEYS);
  values.pos = { lat: event.lat, lon: event.lon };
  if (event.sog != null) values.sog = event.sog;
  if (event.cog != null) values.cog = event.cog;
  values.loch = Math.round((lochBase + event.dist) * 10) / 10;
  if (event.kind) values.evt = [event.kind];
  if (event.kind === 'Arrivée') values.sog = 0;
  if (event.note) values.note = event.note;
  const entry: Entry = {
    id: uid(),
    t: new Date(event.t).toISOString(),
    v: values,
    auto: true,
    needWx: true,
  };
  if (event.twd != null && event.tws != null) {
    values.twd = event.twd;
    values.tws = Math.round(event.tws);
    entry.windSrc = 'trace';
  }
  return entry;
}

/**
 * Add the entry of a key point and fill its weather when the network and the
 * setting allow it (legacy `addAutoEntry`).
 * @param event - Key point.
 * @param lochBase - Log reading at the start of the track.
 * @returns The entry as added (read its `id`: it is frozen, change it with `updateCruise`).
 */
export async function addAutoEntry(
  event: TrackEvent,
  lochBase: number,
): Promise<Entry> {
  const entry = autoEntryFrom(event, lochBase);
  addEntry(entry);
  if (state.preferences.settings.value.autoWeather && navigator.onLine) {
    try {
      if (await enrichEntry(entry.id)) saveCruise();
    } catch {
      // The weather stays pending.
    }
  }
  return entry;
}
