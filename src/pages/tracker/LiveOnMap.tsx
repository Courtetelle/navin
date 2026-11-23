import { useSignals } from '@preact/signals-react/runtime';
import type { Circle, LayerGroup } from 'leaflet';
import { useEffect } from 'react';

import { leaflet } from '../../features/map/leaflet.ts';
import { pendingMapArea } from '../../features/map/pendingArea.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { showZoomOnMap } from '../../features/map/zoomShown.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import {
  liveAlertAsk,
  liveAlertSpot,
  liveStations,
  windConfig,
} from '../../features/onwater/index.ts';
import { buzz } from '../../lib/dom.ts';
import { nmText } from '../../lib/geo.ts';
import { go } from '../../shell/router.ts';
import { alertStation } from '../meteo/alertStation.ts';
import { boatPlace, mapPlace } from '../meteo/boatPlace.ts';
import { blinkKey, liveBlink, liveDetail } from '../meteo/liveDetail.ts';
import { ageText, compassPoint, stationBadgeHtml } from '../meteo/liveText.ts';

import {
  layLiveAround,
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
  return `<b>${escapeText(station.name)}</b><br>${Math.round(station.avg)} nd${gust}${from}<br>${escapeText(station.net)} · ${nmText(station.km ?? 0)} · ${ageText(station.t, Date.now())}<br><small>Appui long sur la pastille : tout le détail</small><br><button type="button" class="btn live-pop-close">Fermer</button>`;
}

/**
 * One badge of a station on the map: a touch opens its short bubble (the
 * badges stay while it is open), a long press its whole card.
 * @param layer - The layer of the badges.
 * @param station - The station.
 * @param basis - Wind the colours follow.
 */
function addBadge(
  layer: LayerGroup,
  station: LiveStation,
  basis: string,
  crowned: boolean,
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
      event.popup
        .getElement()
        ?.querySelector('.live-pop-close')
        ?.addEventListener('click', () => {
          buzz();
          marker.closePopup();
        });
    })
    .addTo(layer);
  const element = marker.getElement();
  if (!element) return;
  // The station of the card just seen, or of the wind alert: larger, a
  // white crown and a red halo that pulses calmly, its name below.
  if (crowned) {
    marker.setZIndexOffset(1000);
    element.classList.add('live-alerted');
  }
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
 * zone chosen with NavIn, else the GPS, the radius of Paramétrages) or of the
 * map shown. They stay until the button of the radius is touched (it goes
 * with them); a touch on one shows its short bubble; a long press opens its
 * whole card, whose ◀ comes back here. A band at the top says how many.
 * @returns The band, or nothing.
 */
export function LiveOnMap() {
  useSignals();
  const asked = liveOnMap.value;
  const around = liveOnMapAround.value;
  const radiusSet = liveRadius();
  const on = asked > 0;
  // The map opened on a storm or a warning light: the winds of LiveMétéo
  // and their circle leave it.
  useEffect(() => {
    if (pendingMapArea() && liveOnMap.peek() > 0) liveOnMap.value = 0;
  }, []);
  // LiveMétéo laid (or the map back from a station): ＋ and − shown too.
  useEffect(() => {
    if (asked > 0) showZoomOnMap();
  }, [asked]);
  // « LiveMétéo » of a wind alert: the stations around the boat.
  const alertAsked = liveAlertAsk.value;
  useEffect(() => {
    if (alertAsked === 0) return;
    liveAlertAsk.value = 0;
    layLiveAround();
  }, [alertAsked]);
  useEffect(() => {
    if (!on) return undefined;
    let closed = false;
    let layer: LayerGroup | null = null;
    let ring: Circle | null = null;
    let zone: Circle | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    // The wind alert this was opened from, and the station whose card was
    // just seen (◀ of its card): crowned; the map opens on it (see
    // buildTrackerMap).
    // Taken once drawn (not here: an effect run twice would lose them).
    const alert = liveAlertSpot.peek();
    const seen = liveBlink.peek();
    let drawn = false;
    let center = around ? (alert?.boat ?? boatPlace()) : mapPlace();
    let radius = around ? radiusSet : RADIUS;
    const config = windConfig();
    const draw = (stations: LiveStation[]) => {
      const map = tracker.current?.map;
      if (closed || !map) return;
      const L = leaflet();
      layer?.remove();
      layer = L.layerGroup().addTo(map);
      const alerted =
        alert && !alert.zone
          ? alertStation(stations, alert.lat, alert.lon)
          : undefined;
      const crowned = seen ?? (alerted ? blinkKey(alerted) : null);
      for (const station of stations) {
        const mine = blinkKey(station) === crowned;
        addBadge(layer, station, config.basis, mine);
      }
      if (!drawn) {
        if (alert) liveAlertSpot.value = null;
        if (seen) liveBlink.value = null;
      }
      drawn = true;
    };
    const read = () => {
      liveStations(center, radius, config.mfKey)
        .then(draw)
        .catch(() => undefined);
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
        // Back from a station card the map is already on its badge.
        if (!seen) {
          map.fitBounds(middle.toBounds(2 * radius * 1000), {
            padding: [16, 16],
          });
        }
        if (alert?.zone) {
          // A forecast alert: the zone its value stands for, in the colour
          // of a badge of the same wind.
          zone = L.circle([alert.lat, alert.lon], {
            radius: alert.zone.km * 1000,
            color: alert.zone.color,
            weight: 3,
            fillColor: alert.zone.color,
            fillOpacity: 0.28,
            interactive: false,
          })
            .bindTooltip('Zone de la prévision', {
              permanent: true,
              direction: 'top',
              className: 'live-zone-tip',
            })
            .addTo(map);
        }
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
      zone?.remove();
    };
  }, [on, asked, around, radiusSet]);
  return null;
}
