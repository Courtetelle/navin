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

/** Radius of the stations laid on the map, in km. */
const RADIUS = 60;
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
 * The live weather stations within 60 km laid on the NavIn map (from the
 * PréP menu): one badge per station, as on Live météo, read again every
 * 2 min; a band at the top says how many, its ✕ takes them away.
 * @returns The band, or nothing.
 */
export function LiveOnMap() {
  useSignals();
  const tr = useTr();
  const on = liveOnMap.value;
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return undefined;
    let closed = false;
    let layer: LayerGroup | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const center = mapPlace();
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
      liveStations(center, RADIUS, config.mfKey)
        .then(draw)
        .catch(() => setCount(0));
    };
    const start = () => {
      if (closed) return;
      if (!tracker.current?.map) {
        wait = setTimeout(start, WAIT_MS);
        return;
      }
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
  }, [on]);
  if (!on) return null;
  return (
    <div className="live-chip" role="status">
      <span>
        {tr(
          count == null
            ? '🌬 Lecture des stations…'
            : `🌬 ${count} station${count > 1 ? 's' : ''} · ${RADIUS} km`,
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
