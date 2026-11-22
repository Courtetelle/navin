import { useSignals } from '@preact/signals-react/runtime';
import type { Circle, LayerGroup } from 'leaflet';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { leaflet } from '../../features/map/leaflet.ts';
import { pendingMapArea } from '../../features/map/pendingArea.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { showZoomOnMap } from '../../features/map/zoomShown.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import {
  liveAlertAsk,
  liveAlertSpot,
  liveStations,
  stationKey,
  windConfig,
} from '../../features/onwater/index.ts';
import { onLake } from '../../features/onwater/onLake.ts';
import { nearSea500, nearWater } from '../../features/onwater/shoreFar.ts';
import type { MeteoZone } from '../../features/zones/meteoZones.ts';
import {
  meteoZones,
  readCircles,
  shownZones,
  stationInZones,
  zonesBox,
  zonesButtonText,
  zonesText,
} from '../../features/zones/meteoZones.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { nmText } from '../../lib/geo.ts';
import { go } from '../../shell/router.ts';
import { alertStation } from '../meteo/alertStation.ts';
import { boatPlace, mapPlace } from '../meteo/boatPlace.ts';
import { blinkKey, liveBlink, liveDetail } from '../meteo/liveDetail.ts';
import { ageText, compassPoint, stationBadgeHtml } from '../meteo/liveText.ts';

import { ZonePicker } from './ZonePicker.tsx';
import {
  hideLiveOnMap,
  layLiveAround,
  liveOnMap,
  liveOnMapAround,
  liveZoneArea,
  liveZoneIds,
  zonePickOpen,
} from './liveOnMap.ts';

/** The stations read before the map of NavIn is built, in km. */
const RADIUS = 60;
/** Without the file of the zones, the stations within 30 NM, in km. */
const FALLBACK_KM = 56;
/** Stations read per network on each circle of a zone. */
const PER_CIRCLE = 10;
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
  const tr = useTr();
  const asked = liveOnMap.value;
  const around = liveOnMapAround.value;
  const zoneKey = liveZoneIds().join(',');
  const on = asked > 0;
  const [count, setCount] = useState<number | null>(null);
  const [zonesShown, setZonesShown] = useState<MeteoZone[]>([]);
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
    let ring: LayerGroup | null = null;
    let zone: Circle | null = null;
    let zones: MeteoZone[] = [];
    let wait: ReturnType<typeof setTimeout> | undefined;
    // The wind alert this was opened from, and the station whose card was
    // just seen (◀ of its card): crowned; the map opens on it (see
    // buildTrackerMap).
    // Taken once drawn (not here: an effect run twice would lose them).
    const alert = liveAlertSpot.peek();
    const seen = liveBlink.peek();
    let drawn = false;
    let center = around ? (alert?.boat ?? boatPlace()) : mapPlace();
    let radius = around ? FALLBACK_KM : RADIUS;
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
      setCount(stations.length);
    };
    const read = () => {
      if (!around || zones.length === 0) {
        // Without the file of the zones: 30 NM around the boat.
        liveStations(center, radius, config.mfKey)
          .then(draw)
          .catch(() => setCount(0));
        return;
      }
      // The zones: their coast read circle by circle, the stations kept
      // when they stand in a zone, at most 500 m inland of the sea (1 km of
      // a lake).
      const most = { open: PER_CIRCLE, mf: PER_CIRCLE };
      Promise.all(
        readCircles(zones, center).map((circle) =>
          liveStations(circle, circle.km, config.mfKey, null, most).catch(
            () => [],
          ),
        ),
      )
        .then(async (lists) => {
          const taken = new Set<string>();
          const inZones = lists.flat().filter((station) => {
            const key = stationKey(station);
            if (taken.has(key)) return false;
            taken.add(key);
            return stationInZones(zones, station.lat, station.lon);
          });
          const lakes = zones.filter((z) => z.kind === 'lac');
          const onLakes = inZones.filter((s) =>
            stationInZones(lakes, s.lat, s.lon),
          );
          const atSea = inZones.filter((s) => !onLakes.includes(s));
          const [sea, lake] = await Promise.all([
            nearSea500(atSea),
            nearWater(onLakes),
          ]);
          const kept = new Set([...sea, ...lake]);
          draw(inZones.filter((s) => kept.has(s)));
        })
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
        // The zones chosen (or that of the boat) drawn, the map zoomed on
        // them.
        void meteoZones().then((all) => {
          if (closed) return;
          zones = shownZones(all, liveZoneIds(), center, onLake());
          setZonesShown(zones);
          const box = zonesBox(zones);
          liveZoneArea.value = box;
          const L = leaflet();
          ring?.remove();
          ring = L.layerGroup().addTo(map);
          for (const shown of zones) {
            L.polygon(
              shown.polys.map((poly) =>
                poly.map((part) =>
                  part.map(([lon, lat]) => [lat, lon] as [number, number]),
                ),
              ),
              {
                color: '#1e5aa8',
                weight: 2,
                dashArray: '6 6',
                fillColor: '#1e5aa8',
                fillOpacity: 0.05,
                interactive: false,
              },
            ).addTo(ring);
          }
          // Back from a station card the map is already on its badge.
          if (box && !seen) {
            map.fitBounds(
              [
                [box.south, box.west],
                [box.north, box.east],
              ],
              { padding: [16, 16] },
            );
          }
          read();
        });
        if (alert?.zone) {
          const L = leaflet();
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
      ring?.remove();
      zone?.remove();
      liveZoneArea.value = null;
      setCount(null);
    };
  }, [on, asked, around, zoneKey]);
  if (!on) return null;
  return (
    <>
      {around ? <ZoneButton zones={zonesShown} /> : null}
      {around ? <ZonePicker /> : null}
      <div className="live-chip" role="status">
        <span className="live-chip-txt">
          {tr(
            count == null
              ? '🌬 Lecture des stations…'
              : `🌬 ${count} station${count > 1 ? 's' : ''} ${around ? `· ${zonesText(zonesShown)}` : 'sur la carte'}`,
          )}
        </span>
        {around ? null : (
          <Button
            type="button"
            noUiEdit
            className="live-chip-off"
            aria-label={tr('Retirer les stations de la carte')}
            onClick={hideLiveOnMap}
          >
            ✕
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * The button of the zone, at the left while LiveMétéo shows the stations of
 * the zones: a dashed outline of a sea zone, the zone in short (or how many)
 * and « zone? » small, a big red cross blinking. A touch takes the badges
 * away with the button; a long press opens the chooser of the Météo-France
 * zones over the map (one or several, or groups of them).
 * @param props - The zones shown.
 * @returns The button.
 */
function ZoneButton({ zones }: { zones: readonly MeteoZone[] }) {
  useSignals();
  const tr = useTr();
  const press = useLongPress(() => {
    buzz();
    zonePickOpen.value = true;
  });
  return (
    <Button
      type="button"
      noUiEdit
      className={`rail-btn live-radius-btn live-zone-btn${press.hit ? ' lp-hit' : ''}`}
      aria-label={tr(
        `Zones LiveMétéo : ${zonesText(zones)} · toucher : retirer les stations · appui long : choisir les zones Météo-France`,
      )}
      onClick={hideLiveOnMap}
      {...press.handlers}
    >
      <svg
        className="live-radius-ico"
        viewBox="0 0 40 40"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <path
          d="M6 9 L19 5 L34 10 L35 27 L24 35 L8 31 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
      </svg>
      {/* The big red cross: a touch takes LiveMétéo away. */}
      <svg
        className="live-radius-x"
        viewBox="0 0 40 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="live-radius-cross"
          d="M5 5l30 30m0-30-30 30"
          stroke="#e00016"
          strokeWidth="6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="live-radius-nb">{zonesButtonText(zones)}</span>
      <span className="live-radius-more" aria-hidden="true">
        zone?
      </span>
    </Button>
  );
}
