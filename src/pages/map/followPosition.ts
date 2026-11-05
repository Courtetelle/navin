import type { Circle, CircleMarker, Map as LeafletMap } from 'leaflet';

import type { LatLngPair } from '../../features/map/constants.ts';
import { leaflet } from '../../features/map/leaflet.ts';
import { isMapLive } from '../../features/map/mapExtras.ts';
import {
  mapWatchActive,
  setMapWatch,
  stopMapWatch,
} from '../../features/map/mapWatch.ts';
import { fr } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import { toast } from '../../state/index.ts';

import type { JournalMapEvents } from './buildJournalMap.ts';

const KNOTS_PER_METRE_SECOND = 1.943_844;

/**
 * The « Suivre ma position » button of the map (legacy `drawLeaflet`): blue dot
 * and accuracy circle, the map follows when the boat nears its edge.
 * @param map - Leaflet map.
 * @param events - What the page wants to know.
 * @returns Starts or stops following.
 */
export function followPosition(
  map: LeafletMap,
  events: JournalMapEvents,
): () => void {
  const L = leaflet();
  let me: CircleMarker | null = null;
  let accuracy: Circle | null = null;
  let first = true;
  const show = ({ coords }: GeolocationPosition) => {
    if (!isMapLive(map)) {
      stopMapWatch();
      return;
    }
    const position: LatLngPair = [coords.latitude, coords.longitude];
    if (me && accuracy) {
      me.setLatLng(position);
      accuracy.setLatLng(position).setRadius(coords.accuracy || 10);
    } else {
      accuracy = L.circle(position, {
        radius: coords.accuracy || 10,
        color: '#0077ff',
        weight: 1,
        fillOpacity: 0.12,
      }).addTo(map);
      me = L.circleMarker(position, {
        radius: 11,
        color: '#fff',
        weight: 4,
        fillColor: '#0077ff',
        fillOpacity: 1,
      }).addTo(map);
    }
    if (first) {
      map.setView(position, Math.max(map.getZoom(), 14));
      first = false;
    } else if (!map.getBounds().pad(-0.15).contains(position)) {
      map.panTo(position);
    }
    const speed =
      coords.speed !== null && coords.speed >= 0
        ? ` · ${fr(coords.speed * KNOTS_PER_METRE_SECOND)} nd`
        : '';
    const text = fmtPos({ lat: position[0], lon: position[1] });
    events.onNote(
      `📍 ${text}${speed} · ± ${Math.round(coords.accuracy || 0)} m`,
    );
  };
  return () => {
    if (mapWatchActive()) {
      stopMapWatch();
      events.onFollow(false);
      return;
    }
    if (!navigator.geolocation) {
      toast('GPS indisponible');
      return;
    }
    first = true;
    setMapWatch(
      navigator.geolocation.watchPosition(
        show,
        () => toast('Position GPS introuvable'),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 30_000 },
      ),
    );
    events.onFollow(true);
  };
}
