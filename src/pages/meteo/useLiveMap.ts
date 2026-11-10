import type { Circle, LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { OSM_TILES, SEAMARK_TILES } from '../../features/map/constants.ts';
import { createMap, leaflet, loadLeaflet } from '../../features/map/leaflet.ts';
import { disposeMap } from '../../features/map/mapExtras.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import { stationKey, windValue } from '../../features/onwater/index.ts';

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
  /** Give the map its size again once shown after being hidden. */
  invalidate: () => void;
  /** Centre a station and show it alone for a moment, to see where it is. */
  focus: (key: string) => void;
  /** Leaflet could not load. */
  noMap: boolean;
  /** Touch screen: the map moves with two fingers, one finger scrolls the page. */
  twoFingers: boolean;
}

/** A touch screen, where one finger must scroll the page. */
function coarsePointer(): boolean {
  return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
}

const KM_TO_M = 1000;

function escapeHtml(text: string): string {
  return text.replaceAll(/[&<>"']/gu, (char) => `&#${char.codePointAt(0)};`);
}
/** How long a station is shown alone. */
const FOCUS_MS = 4000;
/** Closest zoom kept when a station is centred. */
const FOCUS_ZOOM = 12;

/**
 * The map of the stations: one coloured badge per station (mean wind, gusts
 * in small), the circle searched and its centre.
 * @param box - The map element.
 * @param stations - Stations shown.
 * @param search - Centre and radius searched.
 * @param search.center - Centre searched.
 * @param search.radius - Radius in km.
 * @param basis - Wind the colours follow, `'gust'` or `'avg'`.
 * @param onPick - A station is touched.
 * @returns The map handle.
 */
export function useLiveMap(
  box: RefObject<HTMLDivElement | null>,
  stations: readonly LiveStation[],
  search: { center: LivePlace; radius: number },
  basis: string,
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
  }, [ready, stations, basis, lat, lon]);
  return {
    center: () => {
      const shown = map.current;
      if (!shown) return null;
      const middle = shown.getCenter();
      return { lat: middle.lat, lon: middle.lng };
    },
    invalidate: () => map.current?.invalidateSize(),
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
    twoFingers: coarsePointer(),
  };
}
