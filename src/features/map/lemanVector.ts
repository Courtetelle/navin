import { signal } from '@preact/signals-react';

import { fmtShortDate } from '../../lib/format.ts';
import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import type { LatLngPair } from './constants.ts';
import { LEMAN_BBOX } from './constants.ts';
import { docStore } from './external.ts';
import { readRecord, writeRecord } from './idbRecord.ts';
import type { OsmElement, OsmFeature } from './osmFeatures.ts';
import { osmToFeats } from './osmFeatures.ts';
import { shoreRings } from './shore.ts';

/** Vector chart kept on the device (`ldb-docs`, key `leman-osm`). */
export interface LemanVector {
  at: string;
  feats: OsmFeature[];
  shore: LatLngPair[][] | null;
}

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const BOX = `${LEMAN_BBOX.s},${LEMAN_BBOX.w},${LEMAN_BBOX.n},${LEMAN_BBOX.e}`;
const LEMAN_OSM_QUERY = `[out:json][timeout:90];
(
  nwr["seamark:type"](${BOX});
  nwr["leisure"="marina"](${BOX});
  way["man_made"~"^(pier|breakwater|groyne)$"](${BOX});
  nwr["amenity"="ferry_terminal"](${BOX});
);
out tags geom;`;
const LEMAN_SHORE_QUERY = `[out:json][timeout:120];
rel["natural"="water"]["name"~"L[ée]man|Lake Geneva|Genfersee"](${BOX});
out geom;`;

/** Text under the « Données du Léman » button while or after downloading, `null` otherwise. */
export const lemanVecProgress = signal<string | null>(null);
/** Increases when the map must be drawn again with the new data. */
export const lemanVecVersion = signal(0);

const loaded: { vector: LemanVector | null; fetching: boolean } = {
  vector: null,
  fetching: false,
};

/**
 * The vector chart already read (legacy `lemanVec`).
 * @returns The chart, or `null`.
 */
export function lemanVector(): LemanVector | null {
  return loaded.vector;
}

/**
 * Read the vector chart from the device (legacy `lemanVecLoad`).
 * @returns The chart, or `null`.
 */
export async function lemanVecLoad(): Promise<LemanVector | null> {
  if (loaded.vector) return loaded.vector;
  try {
    const objectStore = await docStore('readonly');
    loaded.vector = await readRecord<LemanVector>(objectStore, 'leman-osm');
  } catch {
    loaded.vector = null;
  }
  return loaded.vector;
}

/**
 * State of the vector chart, for the button (legacy `lemanVecNote`).
 * @returns The sentence.
 */
export function lemanVecNote(): string {
  const stored = store.get<{ at: string; n: number } | null>(
    'ldb.lemanVecAt',
    null,
  );
  return stored
    ? `téléchargés le ${fmtShortDate(new Date(stored.at))} (${stored.n} éléments)`
    : 'à télécharger une fois avec du réseau (Wi-Fi conseillé)';
}

/** Download the buoyage, harbours and shore of the lake (legacy `fetchLemanVec`). */
export async function fetchLemanVec(): Promise<void> {
  if (loaded.fetching) return;
  if (!navigator.onLine) {
    toast('Il faut du réseau pour télécharger les balises');
    return;
  }
  loaded.fetching = true;
  lemanVecProgress.value = 'téléchargement depuis OpenStreetMap…';
  const json = await overpass(LEMAN_OSM_QUERY);
  loaded.fetching = false;
  if (!json) {
    lemanVecProgress.value = 'échec : réessayer plus tard avec du réseau';
    toast('OpenStreetMap ne répond pas, réessayez plus tard');
    return;
  }
  const feats = osmToFeats(json);
  lemanVecProgress.value = 'contour du lac…';
  let shore = await shoreOf();
  if (!shore || shore.length === 0) shore = loaded.vector?.shore ?? null;
  try {
    await lemanVecSave({ at: new Date().toISOString(), feats, shore });
  } catch {
    toast('⚠ Impossible d’enregistrer les balises sur ce téléphone');
    return;
  }
  lemanVecProgress.value = null;
  const withShore = shore && shore.length > 0 ? ' et le contour du lac' : '';
  toast(`${feats.length} éléments${withShore} gardés hors ligne`);
  lemanVecVersion.value += 1;
}

async function lemanVecSave(vector: LemanVector): Promise<void> {
  loaded.vector = vector;
  const objectStore = await docStore('readwrite');
  await writeRecord(objectStore, 'leman-osm', vector);
  store.set('ldb.lemanVecAt', { at: vector.at, n: vector.feats.length });
}

async function overpass(query: string): Promise<OsmElement[] | null> {
  /* eslint-disable no-await-in-loop -- the second server is only a fallback */
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (response.ok) {
        const json = (await response.json()) as { elements?: OsmElement[] };
        return json.elements ?? [];
      }
    } catch {
      // The next server may answer.
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}

async function shoreOf(): Promise<LatLngPair[][] | null> {
  /* eslint-disable no-await-in-loop -- the second server is only a fallback */
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(LEMAN_SHORE_QUERY)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (response.ok) {
        const json = (await response.json()) as { elements?: OsmElement[] };
        const rings = shoreRings(json.elements ?? []);
        if (rings.length > 0) return rings;
      }
    } catch {
      // The next server may answer.
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}
