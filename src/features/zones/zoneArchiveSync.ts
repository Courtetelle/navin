import { effect, signal, untracked } from '@preact/signals-react';

import { ANALYSIS_REPO, dispatchWorkflow } from '../../model/analysis.ts';
import { boatPlace } from '../../pages/meteo/boatPlace.ts';
import { liveZoneIds } from '../../pages/tracker/liveOnMap.ts';
import { store } from '../../storage/store.ts';
import { githubKey } from '../onwater/githubKey.ts';
import { onLake } from '../onwater/onLake.ts';

import type { MeteoZone } from './meteoZones.ts';
import { meteoZones, zonesAt } from './meteoZones.ts';
import type { ArchiveIndex } from './stationArchive.ts';
import {
  ARCHIVE_BRANCH,
  ARCHIVE_WORKFLOW,
  parseIndex,
} from './stationArchive.ts';

/** What was last sent to GitHub, `aucune` for none. */
const SENT_KEY = 'ldb.zonesArchived';
/** A change waits this long, so that a few touches are sent once. */
const SETTLE_MS = 20_000;
/** The zone of the boat looked at again this often (« Où je suis »). */
const AGAIN_MS = 3_600_000;

/** The archive on GitHub, to look at it. */
export const ARCHIVE_PAGE = `https://github.com/${ANALYSIS_REPO}/tree/${ARCHIVE_BRANCH}`;

/** Where the sending of the zones stands. */
export interface ArchiveSending {
  /** The zones sent last (ids, `aucune`), empty before. */
  sent: string;
  /** What went wrong the last time, empty when it went. */
  error: string;
}

/** The state of the sending, for Paramétrages. */
export const archiveSending = signal<ArchiveSending>({
  sent: store.get<string>(SENT_KEY, ''),
  error: '',
});

/**
 * The zones whose stations GitHub records: those chosen, else that of the
 * boat; each id once, in a fixed order.
 * @param zones - All the zones.
 * @param chosen - The ids chosen, empty for « Où je suis ».
 * @param place - Where the boat is.
 * @param lake - The boat is on the Léman.
 * @returns The ids, `aucune` when none.
 */
export function archiveZones(
  zones: readonly MeteoZone[],
  chosen: readonly string[],
  place: { lat: number; lon: number },
  lake: boolean,
): string {
  const known = new Set(zones.map((zone) => zone.id));
  const ids =
    chosen.length > 0
      ? chosen.filter((id) => known.has(id))
      : zonesAt(zones, place.lat, place.lon, lake);
  const text = [...new Set(ids)].toSorted().join(',');
  return text || 'aucune';
}

/**
 * Tell GitHub the zones active, when they changed since the last time (or
 * always when asked).
 * @param again - Send even when they did not change.
 * @returns Null when sent or nothing to send, else what went wrong.
 */
export async function sendActiveZones(again = false): Promise<string | null> {
  const key = githubKey();
  if (!key) {
    archiveSending.value = {
      ...archiveSending.peek(),
      error: 'pas de clé GitHub',
    };
    return 'pas de clé GitHub';
  }
  const zones = await meteoZones();
  if (zones.length === 0) return null;
  const chosen = untracked(liveZoneIds);
  const text = archiveZones(zones, chosen, boatPlace(), onLake());
  if (!again && text === store.get<string>(SENT_KEY, '')) return null;
  const error = await dispatchWorkflow(key, ARCHIVE_WORKFLOW, { zones: text });
  if (!error) store.set(SENT_KEY, text);
  archiveSending.value = {
    sent: error ? archiveSending.peek().sent : text,
    error: error ?? '',
  };
  return error;
}

let started = false;

/**
 * Send the zones active to GitHub whenever they change (a little after the
 * last touch), and the zone of the boat every hour.
 */
export function startZoneArchive(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  let wait: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    void liveZoneIds();
    clearTimeout(wait);
    wait = setTimeout(() => void sendActiveZones(), SETTLE_MS);
  });
  setInterval(() => void sendActiveZones(), AGAIN_MS);
}

/**
 * What the archive says of its last reading.
 * @param token - The GitHub key.
 * @param fetcher - fetch (tests pass their own).
 * @returns The index, `null` when it cannot be read (none yet).
 */
export async function readArchiveIndex(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<ArchiveIndex | null> {
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${ANALYSIS_REPO}/contents/index.json?ref=${ARCHIVE_BRANCH}`,
      {
        headers: {
          Accept: 'application/vnd.github.raw+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    return parseIndex(await response.json());
  } catch {
    return null;
  }
}
