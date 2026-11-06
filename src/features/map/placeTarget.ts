import type { CircleMarker, Map as LeafletMap } from 'leaflet';

import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

import { leaflet } from './leaflet.ts';
import { setFollow, tracker } from './trackerState.ts';

/** A place to show on the map. */
export interface PlaceTarget {
  name: string;
  lat: number;
  lon: number;
  /** South, north, west, east: a country or a region is framed whole. */
  bounds?: [number, number, number, number];
}

const ZOOM = 13;
let pending: PlaceTarget | null = null;
let marker: CircleMarker | null = null;

function reveal(map: LeafletMap, place: PlaceTarget): void {
  setFollow(false);
  marker?.remove();
  marker = leaflet()
    .circleMarker([place.lat, place.lon], {
      radius: 9,
      color: '#d00000',
      weight: 3,
      fillOpacity: 0.15,
      // It only points: what lies under it can still be touched.
      interactive: false,
    })
    .bindTooltip(place.name, { permanent: true, direction: 'top' })
    .addTo(map);
  if (place.bounds) {
    const [south, north, west, east] = place.bounds;
    map.fitBounds([
      [south, west],
      [north, east],
    ]);
  } else {
    map.setView([place.lat, place.lon], Math.max(map.getZoom(), ZOOM));
  }
}

/**
 * Show a place on the map of the tracker, opening it when needed.
 * @param place - The place.
 */
export function showPlace(place: PlaceTarget): void {
  const map = tracker.current?.map;
  if (map && state.view.currentView.value === 'tracker') {
    reveal(map, place);
    return;
  }
  pending = place;
  go('tracker');
}

/**
 * Show the place asked before the map of the tracker opened.
 * @param map - The map, just created.
 */
export function showPendingPlace(map: LeafletMap): void {
  if (!pending) return;
  const place = pending;
  pending = null;
  marker = null;
  reveal(map, place);
}
