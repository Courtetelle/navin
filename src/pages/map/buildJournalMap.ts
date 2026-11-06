import type { LatLngExpression, MapOptions } from 'leaflet';

import { addLemanVector } from '../../features/map/addLemanVector.ts';
import type { LatLngPair } from '../../features/map/constants.ts';
import {
  LEMAN_CENTER,
  OSM_TILES,
  SEAMARK_TILES,
  SWISS_BOUNDS,
  SWISS_TILES,
  inSwissArea,
} from '../../features/map/constants.ts';
import { createMap, leaflet } from '../../features/map/leaflet.ts';
import { addFullscreenControl } from '../../features/map/mapControls.ts';
import type { MapDataResult } from '../../features/map/mapData.ts';
import {
  entryColor,
  entryPopup,
  segments,
} from '../../features/map/mapData.ts';
import { disposeMap, whileMapLive } from '../../features/map/mapExtras.ts';
import { setShownMap } from '../../features/map/mapFull.ts';
import {
  swissWhenNoTiles,
  swissWhenOffline,
} from '../../features/map/offlineBase.ts';
import { zoneLayer } from '../../features/map/zoneLayer.ts';
import { zoneAt } from '../../features/map/zoneStore.ts';
import { isLake, state } from '../../state/index.ts';

import { followPosition } from './followPosition.ts';

const DEFAULT_SEA: LatLngPair = [43.1, 5.9];

/** What the map tells its page. */
export interface JournalMapEvents {
  /** Text of `#mapNote`. */
  onNote: (text: string) => void;
  /** The position is followed or not. */
  onFollow: (following: boolean) => void;
}

/** The map of the logbook, once created. */
export interface JournalMap {
  /** Frame the track and the entries. */
  fit: () => void;
  /** Start or stop following my position. */
  toggleFollow: () => void;
  /** Remove the map. */
  dispose: () => void;
}

function chooseSwiss({ line, ents }: MapDataResult): boolean {
  if (isLake()) return true;
  const last = line.at(-1);
  if (last) return inSwissArea(last);
  const first = ents[0];
  return first ? inSwissArea(first.v.pos) : false;
}

function lastPosition({ line, ents }: MapDataResult): LatLngPair | null {
  const last = line.at(-1);
  if (last) return [last.lat, last.lon];
  const first = ents[0];
  if (first) return [first.v.pos.lat, first.v.pos.lon];
  const fix = state.view.lastFix.value;
  return fix ? [fix.lat, fix.lon] : null;
}

/**
 * Create the map of the logbook: backgrounds, track, entries, position followed (legacy `drawLeaflet`).
 * @param box - The `#map` element.
 * @param data - Line and entries of the period.
 * @param events - What the page wants to know.
 * @returns The map handle.
 */
export function buildJournalMap(
  box: HTMLElement,
  data: MapDataResult,
  events: JournalMapEvents,
): JournalMap {
  const L = leaflet();
  const map = createMap(box, {
    zoomControl: true,
    attributionControl: true,
    tap: true,
  } as MapOptions);
  setShownMap(map);
  const tiles = { maxZoom: 19, maxNativeZoom: 18 };
  const osm = L.tileLayer(OSM_TILES, {
    ...tiles,
    crossOrigin: true,
    attribution: '© OpenStreetMap',
  });
  const swiss = L.tileLayer(SWISS_TILES, {
    ...tiles,
    crossOrigin: true,
    bounds: SWISS_BOUNDS,
    attribution: '© swisstopo',
  });
  const seamark = L.tileLayer(SEAMARK_TILES, {
    ...tiles,
    attribution: '© OpenSeaMap',
  });
  const useSwiss = chooseSwiss(data);
  const zoneBase = zoneLayer();
  let base = osm;
  if (useSwiss) base = navigator.onLine ? osm : swiss;
  else if (zoneAt(lastPosition(data))) base = zoneBase;
  base.addTo(map);
  seamark.addTo(map);
  const layers = L.control
    .layers(
      {
        'Carte nationale suisse (Léman)': swiss,
        'Plan OpenStreetMap': osm,
        'Plan des zones hors ligne': zoneBase,
      },
      { 'Balisage OpenSeaMap': seamark },
      { position: 'topright' },
    )
    .addTo(map);
  if (useSwiss) {
    swissWhenOffline(map, osm, swiss);
    void addLemanVector(map, layers);
  }
  swissWhenNoTiles(map, [swiss, osm, zoneBase], swiss);
  addFullscreenControl(map);
  let loaded = 0;
  let errors = 0;
  swiss.on('tileload', () => {
    loaded++;
  });
  swiss.on('tileerror', () => {
    errors++;
    if (errors === 6 && !loaded && navigator.onLine && map.hasLayer(swiss)) {
      map.removeLayer(swiss);
      osm.addTo(map);
      events.onNote(
        'Carte suisse indisponible pour le moment : plan OpenStreetMap affiché.',
      );
    }
  });
  const points: LatLngExpression[] = [];
  for (const part of segments(data.line)) {
    L.polyline(part, { color: '#d00000', weight: 5, opacity: 0.85 }).addTo(map);
    for (const point of part) points.push(point);
  }
  for (const entry of data.ents) {
    const position: LatLngPair = [entry.v.pos.lat, entry.v.pos.lon];
    points.push(position);
    L.circleMarker(position, {
      radius: 11,
      color: '#000',
      weight: 3,
      fillColor: entryColor(entry),
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(entryPopup(entry));
  }
  const fit = () => {
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), {
        padding: [30, 30],
        maxZoom: 15,
      });
    } else if (useSwiss) {
      map.setView(LEMAN_CENTER, 10);
    } else {
      map.setView(DEFAULT_SEA, 8);
    }
  };
  fit();
  whileMapLive(map, () => map.invalidateSize(), 100);
  return {
    fit,
    toggleFollow: followPosition(map, events),
    dispose() {
      disposeMap(map);
      setShownMap(null);
    },
  };
}
