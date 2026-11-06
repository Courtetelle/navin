import { signal } from '@preact/signals-react';

import { indexById } from '../../lib/indexById.ts';
import type { TrackPoint } from '../../state/index.ts';
import {
  loadTrack,
  saveCruise,
  saveTrack,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';

import { autoEntryFrom, lochBefore } from './autoEntries.ts';
import type { ParsedTrack } from './gpxParse.ts';
import { parseGpx } from './gpxParse.ts';
import type { ImportPlan } from './gpxPlan.ts';
import { planImport, thinPoints } from './gpxPlan.ts';
import { enrichEntry } from './weather.ts';

/**
 * Import waiting for confirmation. While it is set, the page that started it
 * shows `<GpxImportScreen />` instead of its content (legacy `importGpxFile`
 * replaced `#view`); any navigation clears it.
 */
export const gpxImportPlan = signal<ImportPlan | null>(null);

/**
 * Read a track and show the import screen (legacy `importGpxFile`).
 * @param file - GPX file.
 * @param parsed - Points already read from another format (NMEA file).
 */
export async function importGpxFile(
  file: File,
  parsed?: ParsedTrack,
): Promise<void> {
  let track: ParsedTrack;
  try {
    track = parsed ?? parseGpx(await file.text());
  } catch {
    toast('Fichier GPX illisible');
    return;
  }
  if (track.pts.length < 2) {
    toast('Aucun point trouvé dans ce fichier');
    return;
  }
  if (track.pts.some((point) => Number.isNaN(point.t))) {
    toast('Cette trace n’a pas d’heures : impossible de dater les entrées');
    return;
  }
  gpxImportPlan.value = planImport(track, file.name);
  globalThis.scrollTo(0, 0);
}

/**
 * Apply an import (legacy `#gpxGo`): create the entries, complete the noted
 * ones, keep the track, fetch the weather.
 * @param plan - Import to apply.
 * @param keepTrack - Add the points to the track of the map.
 * @param onProgress - Receives the label of the weather progress.
 * @returns Number of entries created.
 */
export async function applyImport(
  plan: ImportPlan,
  keepTrack: boolean,
  onProgress: (label: string) => void,
): Promise<number> {
  const firstTime = plan.points[0]?.t ?? 0;
  const lochBase = lochBefore(new Date(firstTime).toISOString());
  const created = plan.fresh.map((event) => autoEntryFrom(event, lochBase));
  updateCruise((cruise) => {
    cruise.entries.push(...created);
    const entries = indexById(cruise.entries);
    for (const { id, add } of plan.fills) {
      const entry = entries.get(id);
      if (!entry) continue;
      Object.assign(entry.v, add);
      if (add.tws != null) entry.windSrc = 'trace';
    }
    cruise.entries.sort((first, second) => first.t.localeCompare(second.t));
  });
  if (keepTrack) saveImportedTrack(plan);
  if (state.preferences.settings.value.autoWeather && navigator.onLine) {
    await fillCreatedWeather(
      created.map((entry) => entry.id),
      onProgress,
    );
  }
  return created.length;
}

function saveImportedTrack(plan: ImportPlan): void {
  const track = loadTrack();
  const seen = new Set<number>();
  for (const point of track) seen.add(point[0]);
  const merged: TrackPoint[] = [...track];
  for (const point of thinPoints(plan.points)) {
    if (seen.has(point.t)) continue;
    merged.push([
      point.t,
      Math.round(point.lat * 1e6) / 1e6,
      Math.round(point.lon * 1e6) / 1e6,
    ]);
  }
  saveTrack(merged.toSorted((first, second) => first[0] - second[0]));
}

async function fillCreatedWeather(
  ids: readonly string[],
  onProgress: (label: string) => void,
): Promise<void> {
  /* eslint-disable no-await-in-loop -- one request at a time, with the progress shown */
  for (const [index, id] of ids.entries()) {
    onProgress(`⏳ Météo ${index + 1} / ${ids.length}…`);
    try {
      await enrichEntry(id);
    } catch {
      // The weather stays pending.
    }
  }
  /* eslint-enable no-await-in-loop */
  saveCruise();
}
