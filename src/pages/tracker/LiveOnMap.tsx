import { useSignals } from '@preact/signals-react/runtime';
import type { Circle, LayerGroup, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import { liveStations, windConfig } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { boatPlace, mapPlace } from '../meteo/boatPlace.ts';
import { liveDetail } from '../meteo/liveDetail.ts';
import { ageText, compassPoint, stationBadgeHtml } from '../meteo/liveText.ts';

import {
  hideLiveOnMap,
  liveOnMap,
  liveOnMapAround,
  liveRadius,
} from './liveOnMap.ts';

/** The stations read before the map of NavIn is built, in km. */
const RADIUS = 60;
/** The circle read around the map shown stays within these, in km. */
const LEAST_KM = 5;
const MOST_KM = 150;
/** The stations are read again this often. */
const REFRESH_MS = 2 * 60_000;
/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 300;
/** The badges stay this long, then fade; a touch on one gives them more. */
const SHOWN_MS = 6000;
/** A press this long on a badge opens the whole card of the station. */
const LONG_MS = 600;

function escapeText(text: string): string {
  return text.replaceAll(/[&<>"']/gu, (char) => `&#${char.codePointAt(0)};`);
}

/**
 * The short bubble of a station: its wind now, its network, its distance,
 * no past and no detail; « Fermer » back to the map.
 * @param station - The station.
 * @returns The HTML.
 */
function popupHtml(station: LiveStation): string {
  const gust =
    station.gust == null ? '' : `, rafales ${Math.round(station.gust)}`;
  const from = station.dir == null ? '' : ` · du ${compassPoint(station.dir)}`;
  return `<b>${escapeText(station.name)}</b><br>${Math.round(station.avg)} nd${gust}${from}<br>${escapeText(station.net)} · ${Math.round(station.km ?? 0)} km · ${ageText(station.t, Date.now())}<br><small>Appui long sur la pastille : tout le détail</small><br><button type="button" class="btn live-pop-close">Fermer</button>`;
}

/**
 * One badge of a station on the map: a touch opens its short bubble (the
 * badges stay while it is open), a long press its whole card.
 * @param layer - The layer of the badges.
 * @param station - The station.
 * @param basis - Wind the colours follow.
 * @param hold - Set while a bubble is open.
 * @param hold.on - A bubble is open.
 * @param restart - Shows the badges for 6 s more.
 */
function addBadge(
  layer: LayerGroup,
  station: LiveStation,
  basis: string,
  hold: { on: boolean },
  restart: () => void,
): void {
  const L = leaflet();
  let pressing: ReturnType<typeof setTimeout> | undefined;
  let long = false;
  const marker = L.marker([station.lat, station.lon], {
    icon: L.divIcon({
      className: 'live-mk-wrap',
      html: stationBadgeHtml(station, basis),
      iconSize: [0, 0],
    }),
    keyboard: false,
    title: station.name,
  })
    .bindPopup(popupHtml(station), { maxWidth: 300 })
    .on('popupopen', (event) => {
      if (long) {
        marker.closePopup();
        return;
      }
      hold.on = true;
      restart();
      event.popup
        .getElement()
        ?.querySelector('.live-pop-close')
        ?.addEventListener('click', () => {
          buzz();
          marker.closePopup();
        });
    })
    .on('popupclose', () => {
      hold.on = false;
      restart();
    })
    .addTo(layer);
  const element = marker.getElement();
  if (!element) return;
  // A long press: the whole card of the station, ◀ back here.
  element.addEventListener('pointerdown', () => {
    long = false;
    clearTimeout(pressing);
    pressing = setTimeout(() => {
      long = true;
      buzz();
      liveDetail.value = station;
      go('meteo');
    }, LONG_MS);
  });
  const release = () => clearTimeout(pressing);
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) {
    element.addEventListener(name, release);
  }
}

/**
 * LiveMétéo on the NavIn map: the badges of the stations of the zone (the
 * zone chosen with NavIn, else the GPS, the radius of Réglages) or of the
 * map shown (long press on Météo). They stay 6 s then fade; a touch on one
 * shows its short bubble and keeps them; a long press opens its whole card,
 * whose ◀ comes back here. A band at the top says how many: touched, it
 * shows them again; its ✕ takes them away.
 * @returns The band, or nothing.
 */
export function LiveOnMap() {
  useSignals();
  const tr = useTr();
  const asked = liveOnMap.value;
  const around = liveOnMapAround.value;
  const radiusSet = liveRadius();
  const on = asked > 0;
  const [count, setCount] = useState<number | null>(null);
  const showAgain = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!on) return undefined;
    let closed = false;
    let layer: LayerGroup | null = null;
    let ring: Circle | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let fade: ReturnType<typeof setTimeout> | undefined;
    const hold = { on: false };
    let center = around ? boatPlace() : mapPlace();
    let radius = around ? radiusSet : RADIUS;
    const config = windConfig();
    const shown = (map: LeafletMap, visible: boolean) => {
      map.getContainer().classList.toggle('live-faded', !visible);
      ring?.setStyle({ opacity: visible ? 1 : 0 });
    };
    // Shown for 6 s, then faded, unless a bubble is open.
    const restart = () => {
      const map = tracker.current?.map;
      if (!map || closed) return;
      shown(map, true);
      clearTimeout(fade);
      fade = setTimeout(() => {
        if (!hold.on) shown(map, false);
      }, SHOWN_MS);
    };
    showAgain.current = restart;
    const draw = (stations: LiveStation[]) => {
      const map = tracker.current?.map;
      if (closed || !map) return;
      const L = leaflet();
      layer?.remove();
      layer = L.layerGroup().addTo(map);
      for (const station of stations) {
        addBadge(layer, station, config.basis, hold, restart);
      }
      setCount(stations.length);
      restart();
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
        // The circle of the zone drawn, the map zoomed on it.
        const L = leaflet();
        const middle = L.latLng(center.lat, center.lon);
        ring?.remove();
        ring = L.circle(middle, {
          radius: radius * 1000,
          color: '#1e5aa8',
          weight: 2,
          fill: false,
          dashArray: '6 6',
          interactive: false,
        }).addTo(map);
        map.fitBounds(middle.toBounds(2 * radius * 1000), {
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
      clearTimeout(fade);
      clearInterval(timer);
      layer?.remove();
      ring?.remove();
      tracker.current?.map?.getContainer().classList.remove('live-faded');
      showAgain.current = () => undefined;
      setCount(null);
    };
  }, [on, asked, around, radiusSet]);
  if (!on) return null;
  return (
    <div className="live-chip" role="status">
      <button
        type="button"
        className="live-chip-txt"
        aria-label={tr('Montrer de nouveau les stations')}
        onClick={() => {
          buzz();
          showAgain.current();
        }}
      >
        {tr(
          count == null
            ? '🌬 Lecture des stations…'
            : `🌬 ${count} station${count > 1 ? 's' : ''} ${around ? `à moins de ${radiusSet} km` : 'sur la carte'}`,
        )}
      </button>
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
