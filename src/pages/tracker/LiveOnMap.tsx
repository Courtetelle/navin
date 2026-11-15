import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup } from 'leaflet';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import { liveStations, windConfig } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { mapPlace } from '../meteo/boatPlace.ts';
import { ageText, compassPoint, stationBadgeHtml } from '../meteo/liveText.ts';

import { hideLiveOnMap, liveOnMap } from './liveOnMap.ts';

/** Radius read before the map of NavIn is built, in km. */
const RADIUS = 60;
/** The circle read around the map shown stays within these, in km. */
const LEAST_KM = 5;
const MOST_KM = 150;
/** The stations are read again this often. */
const REFRESH_MS = 2 * 60_000;
/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 300;

function escapeText(text: string): string {
  return text.replaceAll(/[&<>"']/gu, (char) => `&#${char.codePointAt(0)};`);
}

function popupHtml(station: LiveStation): string {
  const gust =
    station.gust == null ? '' : `, rafales ${Math.round(station.gust)}`;
  const from = station.dir == null ? '' : ` · ${compassPoint(station.dir)}`;
  return `<b>${escapeText(station.name)}</b><br>${Math.round(station.avg)} nd${gust}${from}<br>${escapeText(station.net)} · ${Math.round(station.km ?? 0)} km · ${ageText(station.t, Date.now())}`;
}

/**
 * The live weather stations of the map shown laid on the NavIn map (long
 * press on Météo, or its menu): the circle from the middle of the map to its
 * corners is read, one badge per station, as on LiveMétéo, read again every
 * 2 min; a band at the top says how many, its ✕ takes them away.
 * @returns The band, or nothing.
 */
export function LiveOnMap() {
  useSignals();
  const tr = useTr();
  const asked = liveOnMap.value;
  const on = asked > 0;
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return undefined;
    let closed = false;
    let layer: LayerGroup | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let center = mapPlace();
    let radius = RADIUS;
    const config = windConfig();
    const draw = (stations: LiveStation[]) => {
      const map = tracker.current?.map;
      if (closed || !map) return;
      const L = leaflet();
      layer?.remove();
      layer = L.layerGroup().addTo(map);
      for (const station of stations) {
        L.marker([station.lat, station.lon], {
          icon: L.divIcon({
            className: 'live-mk-wrap',
            html: stationBadgeHtml(station, config.basis),
            iconSize: [0, 0],
          }),
          keyboard: false,
          title: station.name,
        })
          .bindPopup(popupHtml(station))
          .addTo(layer);
      }
      setCount(stations.length);
    };
    const read = () => {
      liveStations(center, radius, config.mfKey)
        .then(draw)
        .catch(() => setCount(0));
    };
    const start = () => {
      if (closed) return;
      const map = tracker.current?.map;
      if (!map) {
        wait = setTimeout(start, WAIT_MS);
        return;
      }
      // The map shown: from its middle to its corners.
      const middle = map.getCenter();
      center = { lat: middle.lat, lon: middle.lng };
      const corner = middle.distanceTo(map.getBounds().getNorthEast()) / 1000;
      radius = Math.min(MOST_KM, Math.max(LEAST_KM, Math.round(corner)));
      read();
    };
    start();
    const timer = setInterval(read, REFRESH_MS);
    return () => {
      closed = true;
      clearTimeout(wait);
      clearInterval(timer);
      layer?.remove();
      setCount(null);
    };
  }, [on, asked]);
  if (!on) return null;
  return (
    <div className="live-chip" role="status">
      <span>
        {tr(
          count == null
            ? '🌬 Lecture des stations…'
            : `🌬 ${count} station${count > 1 ? 's' : ''} sur la carte`,
        )}
      </span>
      <Button
        type="button"
        noUiEdit
        className="live-chip-off"
        aria-label={tr('Retirer les stations de la carte')}
        onClick={hideLiveOnMap}
      >
        ✕
      </Button>
    </div>
  );
}
