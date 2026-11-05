import type { Map as LeafletMap, MapOptions } from 'leaflet';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { GeoBox, LatLngPair } from '../../features/map/constants.ts';
import { LEMAN_CENTER, SEAMARK_TILES } from '../../features/map/constants.ts';
import { createMap, leaflet, loadLeaflet } from '../../features/map/leaflet.ts';
import { addFullscreenControl } from '../../features/map/mapControls.ts';
import { disposeMap } from '../../features/map/mapExtras.ts';
import { zoneLayer } from '../../features/map/zoneLayer.ts';
import {
  ZONE_MAX,
  zoneEstimate,
  zoneList,
  zoneTileXY,
} from '../../features/map/zoneStore.ts';
import { isLake, state } from '../../state/index.ts';

/** What the zone map gives to the page. */
export interface ZoneMap {
  /** The map, once created. */
  map: RefObject<LeafletMap | null>;
  /** Text under the map. */
  estimate: string;
  /** The zone is too big for this detail. */
  tooBig: boolean;
  /** The map could not be created. */
  unavailable: boolean;
}

/**
 * The bounds shown by a map as a geographic box.
 * @param map - Leaflet map.
 * @returns The box.
 */
export function mapBox(map: LeafletMap): GeoBox {
  const bounds = map.getBounds();
  return {
    s: bounds.getSouth(),
    n: bounds.getNorth(),
    w: bounds.getWest(),
    e: bounds.getEast(),
  };
}

/**
 * The map of the zones screen and the estimate of the download (legacy `renderZones`).
 * @param box - The `#zoneMap` element.
 * @param zoomMax - Level of detail chosen.
 * @returns The map and the estimate.
 */
export function useZoneMap(
  box: RefObject<HTMLDivElement | null>,
  zoomMax: number,
): ZoneMap {
  const map = useRef<LeafletMap | null>(null);
  const [estimate, setEstimate] = useState('');
  const [tooBig, setTooBig] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const zoom = useRef(zoomMax);
  const refresh = useCallback(() => {
    if (!map.current) return;
    const tiles = zoneTileXY(mapBox(map.current), zoom.current).length;
    setEstimate(zoneEstimate(tiles));
    setTooBig(tiles > ZONE_MAX);
  }, []);
  useEffect(() => {
    zoom.current = zoomMax;
    refresh();
  }, [zoomMax, refresh]);
  useEffect(() => {
    let closed = false;
    loadLeaflet()
      .then(() => {
        if (closed || !box.current) return;
        map.current = buildZoneMap(box.current, refresh);
        refresh();
      })
      .catch(() => {
        if (!closed) setUnavailable(true);
      });
    return () => {
      closed = true;
      if (map.current) disposeMap(map.current);
      map.current = null;
    };
  }, [box, refresh]);
  return { map, estimate, tooBig, unavailable };
}

function buildZoneMap(box: HTMLElement, onMove: () => void): LeafletMap {
  const L = leaflet();
  const map = createMap(box, { zoomControl: true, tap: true } as MapOptions);
  zoneLayer().addTo(map);
  L.tileLayer(SEAMARK_TILES, {
    maxZoom: 19,
    maxNativeZoom: 18,
    attribution: '© OpenSeaMap',
  }).addTo(map);
  for (const zone of zoneList()) {
    L.rectangle(
      [
        [zone.b.s, zone.b.w],
        [zone.b.n, zone.b.e],
      ],
      { color: '#0050d0', weight: 2, fillOpacity: 0.08 },
    )
      .bindTooltip(zone.name)
      .addTo(map);
  }
  map.setView(startPosition(), 10);
  map.on('moveend zoomend', onMove);
  addFullscreenControl(map);
  return map;
}

function startPosition(): LatLngPair {
  const fix = state.view.lastFix.value;
  if (fix) return [fix.lat, fix.lon];
  return state.data.cruise.value && isLake() ? LEMAN_CENTER : [43.1, 5.9];
}
