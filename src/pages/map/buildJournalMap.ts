import type { LatLngExpression, MapOptions } from 'leaflet';

import { addLemanVector } from '../../features/map/addLemanVector.ts';
import type { LatLngPair } from '../../features/map/constants.ts';
import {
  OSM_TILES,
  SEAMARK_TILES,
  SWISS_BOUNDS,
  SWISS_TILES,
  inSwissArea,
} from '../../features/map/constants.ts';
import { lakeCenter, lakeZoom } from '../../features/map/lakeCenter.ts';
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
import { addOfflineMaps } from '../../features/map/offlineMapLayer.ts';
import { SWISS_BOX, addRegional } from '../../features/map/regionalLayers.ts';
import { addRulerControl } from '../../features/map/rulerTool.ts';
import { SEA_ZOOM, seaCenter } from '../../features/map/seaCenter.ts';
import { smoothLine } from '../../features/map/smoothLine.ts';
import { keepTilesFilled } from '../../features/map/tileFallback.ts';
import { isLake } from '../../state/index.ts';

import { followPosition } from './followPosition.ts';

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
    subdomains: 'abc',
    crossOrigin: true,
    attribution: '© OpenStreetMap France',
  });
  const seamark = L.tileLayer(SEAMARK_TILES, {
    ...tiles,
    attribution: '© OpenSeaMap',
  });
  const useSwiss = chooseSwiss(data);
  const swiss = L.tileLayer(SWISS_TILES, {
    ...tiles,
    crossOrigin: true,
    bounds: SWISS_BOUNDS,
    attribution: '© swisstopo',
  });
  osm.addTo(map);
  seamark.addTo(map);
  const layers = L.control
    .layers(
      { 'Plan OpenStreetMap': osm },
      { 'Balisage OpenSeaMap': seamark },
      { position: 'topright' },
    )
    .addTo(map);
  // The Swiss map only in the menu over Switzerland.
  addRegional(map, layers, swiss, 'Carte nationale suisse', SWISS_BOX, osm);
  if (useSwiss) void addLemanVector(map, layers, osm);
  keepTilesFilled(map, [osm, swiss]);
  void addOfflineMaps(map, layers, osm);
  addFullscreenControl(map);
  addRulerControl(map);
  const points: LatLngExpression[] = [];
  for (const part of segments(data.line)) {
    L.polyline(smoothLine(part), {
      color: '#d00000',
      weight: 5,
      opacity: 0.85,
    }).addTo(map);
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
      map.setView(lakeCenter(), lakeZoom());
    } else {
      map.setView(seaCenter(), SEA_ZOOM);
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
