import { useSignals } from '@preact/signals-react/runtime';
import type { Circle, LayerGroup, Popup } from 'leaflet';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { trendPicture } from '../../features/onwater/alertPublish.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import {
  liveStations,
  stationHistory,
  windConfig,
} from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { boatPlace, mapPlace } from '../meteo/boatPlace.ts';
import { ageText, compassPoint, stationBadgeHtml } from '../meteo/liveText.ts';

import { hideLiveOnMap, liveOnMap, liveOnMapAround } from './liveOnMap.ts';

/** The past shown in the bubble of a station: 24 hours. */
const TREND_MS = 24 * 3_600_000;

/**
 * The wind of the last 24 hours of a station, drawn in its bubble (NavIn
 * records the stations around the zone or the GPS every 10 minutes).
 * @param popup - The bubble.
 * @param station - The station.
 * @param mfKey - The Météo-France key.
 */
async function trendInto(
  popup: Popup,
  station: LiveStation,
  mfKey: string,
): Promise<void> {
  const base = popupHtml(station);
  popup.setContent(`${base}<br><i>Tendance 24 h…</i>`);
  const points = await stationHistory(
    { id: station.id, net: station.net },
    mfKey,
    Date.now(),
    TREND_MS,
  ).catch(() => []);
  const picture = points.length >= 3 ? trendPicture(points) : null;
  popup.setContent(
    picture
      ? `${base}<br><img class="live-pop-trend" src="${picture}" alt="Vent des dernières 24 h">`
      : `${base}<br><i>Pas encore d’historique : NavIn enregistre la station toutes les 10 min.</i>`,
  );
}

/** Radius read around the zone, and before the map of NavIn is built, in km. */
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
  const around = liveOnMapAround.value;
  const on = asked > 0;
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return undefined;
    let closed = false;
    let layer: LayerGroup | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let center = around ? boatPlace() : mapPlace();
    let radius = RADIUS;
    let ring: Circle | null = null;
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
          .bindPopup(popupHtml(station), { maxWidth: 340 })
          .on('popupopen', (event) => {
            void trendInto(event.popup, station, config.mfKey);
          })
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
      if (around) {
        // 120 km across around the zone or the GPS: the circle drawn, the
        // map zoomed on it.
        const L = leaflet();
        const middle = L.latLng(center.lat, center.lon);
        ring?.remove();
        ring = L.circle(middle, {
          radius: RADIUS * 1000,
          color: '#1e5aa8',
          weight: 2,
          fill: false,
          dashArray: '6 6',
          interactive: false,
        }).addTo(map);
        map.fitBounds(middle.toBounds(2 * RADIUS * 1000), {
          padding: [16, 16],
        });
      } else {
        // The map shown: from its middle to its corners.
        const middle = map.getCenter();
        center = { lat: middle.lat, lon: middle.lng };
        const corner = middle.distanceTo(map.getBounds().getNorthEast()) / 1000;
        radius = Math.min(MOST_KM, Math.max(LEAST_KM, Math.round(corner)));
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
      ring?.remove();
      setCount(null);
    };
  }, [on, asked, around]);
  if (!on) return null;
  return (
    <div className="live-chip" role="status">
      <span>
        {tr(
          count == null
            ? '🌬 Lecture des stations…'
            : `🌬 ${count} station${count > 1 ? 's' : ''} ${around ? `à moins de ${RADIUS} km` : 'sur la carte'}`,
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
