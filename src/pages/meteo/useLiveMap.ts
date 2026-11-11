import type { Circle, LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { OSM_TILES, SEAMARK_TILES } from '../../features/map/constants.ts';
import { createMap, leaflet, loadLeaflet } from '../../features/map/leaflet.ts';
import { disposeMap } from '../../features/map/mapExtras.ts';
import type { AlertSpot, LiveStation } from '../../features/onwater/index.ts';
import { stationKey, windValue } from '../../features/onwater/index.ts';
import { distKm } from '../../lib/geo.ts';
import { toast } from '../../state/index.ts';

import { windColors } from './liveText.ts';

/** A place on the map. */
export interface LivePlace {
  lat: number;
  lon: number;
}

/** The map of the live screen, as the page sees it. */
export interface LiveMap {
  /** Centre of the map now, to search there. */
  center: () => LivePlace | null;
  /**
   * Back to the map: its size again once shown after being hidden, and the
   * whole circle searched in view, as when it opened.
   */
  invalidate: () => void;
  /** Centre a station and show it alone for a moment, to see where it is. */
  focus: (key: string) => void;
  /** Leaflet could not load. */
  noMap: boolean;
}

/** A touch screen, where one finger must scroll the page. */
function coarsePointer(): boolean {
  return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
}

const KM_TO_M = 1000;
/** The two-finger hint comes back at most this often. */
const HINT_EVERY_MS = 20_000;

function escapeHtml(text: string): string {
  return text.replaceAll(/[&<>"']/gu, (char) => `&#${char.codePointAt(0)};`);
}
/** How long a station is shown alone. */
const FOCUS_MS = 4000;
/** Closest zoom kept when a station is centred. */
const FOCUS_ZOOM = 12;

/** A station this close to the place of an alert is the one that gave it. */
const SAME_STATION_KM = 0.3;

/**
 * The station that gave a wind alert, among those shown.
 * @param stations - Stations shown.
 * @param lat - Latitude of the station of the alert.
 * @param lon - Its longitude.
 * @returns The closest one within 300 m, or `undefined`.
 */
export function alertStation(
  stations: readonly LiveStation[],
  lat: number,
  lon: number,
): LiveStation | undefined {
  let best: LiveStation | undefined;
  let bestKm = SAME_STATION_KM;
  for (const station of stations) {
    const km = distKm(lat, lon, station.lat, station.lon);
    if (km <= bestKm) {
      best = station;
      bestKm = km;
    }
  }
  return best;
}

/**
 * The map of the stations: one coloured badge per station (mean wind, gusts
 * in small), the circle searched and its centre.
 * @param box - The map element.
 * @param stations - Stations shown.
 * @param search - Centre and radius searched.
 * @param search.center - Centre searched.
 * @param search.radius - Radius in km.
 * @param basis - Wind the colours follow, `'gust'` or `'avg'`.
 * @param alert - The station of a wind alert, blinking in a red band.
 * @param onPick - A station is touched.
 * @returns The map handle.
 */
export function useLiveMap(
  box: RefObject<HTMLDivElement | null>,
  stations: readonly LiveStation[],
  search: { center: LivePlace; radius: number },
  basis: string,
  alert: AlertSpot | null,
  onPick: (key: string) => void,
): LiveMap {
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const circle = useRef<Circle | null>(null);
  const pick = useRef(onPick);
  const markers = useRef(new Map<string, Marker>());
  const focused = useRef<{
    key: string;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  useEffect(() => {
    pick.current = onPick;
  });
  const [noMap, setNoMap] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let closed = false;
    loadLeaflet()
      .then((L) => {
        if (closed || !box.current) return;
        // On a touch screen one finger scrolls the page: the map moves and
        // zooms with two fingers (the pinch also pans).
        const created = createMap(box.current, {
          zoomControl: true,
          attributionControl: true,
          dragging: !coarsePointer(),
        });
        L.tileLayer(OSM_TILES, {
          maxZoom: 19,
          maxNativeZoom: 18,
          subdomains: 'abc',
          crossOrigin: true,
          attribution: '© OpenStreetMap France',
        }).addTo(created);
        L.tileLayer(SEAMARK_TILES, {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution: '© OpenSeaMap',
        }).addTo(created);
        layer.current = L.layerGroup().addTo(created);
        if (coarsePointer()) {
          // One finger scrolls the page: say once in a while how to move the map.
          let told = 0;
          created.getContainer().addEventListener(
            'touchmove',
            (event) => {
              if (event.touches.length !== 1) return;
              const now = Date.now();
              if (now - told < HINT_EVERY_MS) return;
              told = now;
              toast('Deux doigts pour déplacer ou zoomer la carte');
            },
            { passive: true },
          );
        }
        map.current = created;
        setReady(true);
      })
      .catch(() => {
        if (!closed) setNoMap(true);
      });
    return () => {
      closed = true;
      if (focused.current) clearTimeout(focused.current.timer);
      if (map.current) disposeMap(map.current);
      map.current = null;
      layer.current = null;
      circle.current = null;
    };
  }, [box]);
  const { lat, lon } = search.center;
  const { radius } = search;
  useEffect(() => {
    const shown = map.current;
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- keeps Leaflet, outside React, in step with the props
    if (!ready || !shown) return;
    const L = leaflet();
    circle.current?.remove();
    circle.current = L.circle([lat, lon], {
      radius: radius * KM_TO_M,
      color: '#1e5aa8',
      weight: 2,
      fill: false,
      dashArray: '6 6',
      interactive: false,
    }).addTo(shown);
    // Bounds from the place itself: the circle has none before the map has a view.
    shown.fitBounds(L.latLng(lat, lon).toBounds(2 * radius * KM_TO_M), {
      padding: [10, 10],
    });
  }, [ready, lat, lon, radius]);
  const alertLat = alert?.lat;
  const alertLon = alert?.lon;
  useEffect(() => {
    const group = layer.current;
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- keeps Leaflet, outside React, in step with the props
    if (!ready || !group) return;
    const L = leaflet();
    group.clearLayers();
    markers.current.clear();
    L.circleMarker([lat, lon], {
      radius: 6,
      color: '#fff',
      weight: 2,
      fillColor: '#1e5aa8',
      fillOpacity: 1,
      interactive: false,
    }).addTo(group);
    for (const station of stations) {
      const { color, ink } = windColors(windValue(station, basis));
      const gust =
        station.gust == null
          ? ''
          : `<small>${Math.round(station.gust)}</small>`;
      const arrow =
        station.dir == null
          ? ''
          : `<i style="transform:rotate(${Math.round(station.dir)}deg)">↓</i>`;
      const key = stationKey(station);
      const marker = L.marker([station.lat, station.lon], {
        icon: L.divIcon({
          className: 'live-mk-wrap',
          html: `<div class="live-mk" data-name="${escapeHtml(station.name)}" style="--c:${color};--ink:${ink}">${arrow}<b>${Math.round(station.avg)}</b>${gust}</div>`,
          iconSize: [0, 0],
        }),
        keyboard: false,
        title: station.name,
      })
        .on('click', () => pick.current(key))
        .addTo(group);
      markers.current.set(key, marker);
      if (focused.current?.key === key) {
        marker.getElement()?.classList.add('live-focused');
      }
    }
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- keeps Leaflet, outside React, in step with the props
    if (alertLat == null || alertLon == null) return;
    // The station of the wind alert: its badge in a red band that blinks,
    // the other stations still shown around it.
    const alerted = alertStation(stations, alertLat, alertLon);
    if (alerted) {
      const marker = markers.current.get(stationKey(alerted));
      marker?.setZIndexOffset(1000);
      marker?.getElement()?.classList.add('live-alerted');
      return;
    }
    // Stations not read yet: nothing, the badge gets its band once shown.
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- keeps Leaflet, outside React, in step with the props
    if (stations.length === 0) return;
    // Its station no longer answers: a red band on its place.
    L.marker([alertLat, alertLon], {
      icon: L.divIcon({
        className: 'live-alert-wrap',
        html: '<div class="live-alert-ring"></div>',
        iconSize: [0, 0],
      }),
      interactive: false,
      keyboard: false,
    }).addTo(group);
  }, [ready, stations, basis, lat, lon, alertLat, alertLon]);
  return {
    center: () => {
      const shown = map.current;
      if (!shown) return null;
      const middle = shown.getCenter();
      return { lat: middle.lat, lon: middle.lng };
    },
    invalidate: () => {
      const shown = map.current;
      if (!shown) return;
      shown.invalidateSize();
      shown.fitBounds(
        leaflet()
          .latLng(lat, lon)
          .toBounds(2 * radius * KM_TO_M),
        { padding: [10, 10], animate: false },
      );
    },
    focus: (key) => {
      const shown = map.current;
      const marker = markers.current.get(key);
      if (!shown || !marker) return;
      shown.invalidateSize();
      shown.setView(marker.getLatLng(), Math.max(shown.getZoom(), FOCUS_ZOOM), {
        animate: false,
      });
      if (focused.current) clearTimeout(focused.current.timer);
      const box = shown.getContainer();
      for (const element of box.querySelectorAll('.live-focused')) {
        element.classList.remove('live-focused');
      }
      marker.getElement()?.classList.add('live-focused');
      box.classList.add('live-focus');
      focused.current = {
        key,
        timer: globalThis.setTimeout(() => {
          box.classList.remove('live-focus');
          for (const element of box.querySelectorAll('.live-focused')) {
            element.classList.remove('live-focused');
          }
          focused.current = null;
        }, FOCUS_MS),
      };
    },
    noMap,
  };
}
