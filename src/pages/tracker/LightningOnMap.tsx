import { useSignals } from '@preact/signals-react/runtime';
import type { Coords, DoneCallback, LayerGroup, TileLayer } from 'leaflet';
import { useEffect } from 'react';

import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type {
  LightningReport,
  LightningSettings,
} from '../../features/onwater/lightning.ts';
import {
  LIGHTNING_LAYER,
  LIGHTNING_WMS,
  degreesText,
  hourText,
  lightningClearNoData,
  lightningEta,
  lightningEtaShown,
  lightningOnMap,
  lightningTimes,
  nmOf,
  pointAt,
  pointOf,
} from '../../features/onwater/lightning.ts';
import {
  alertPlace,
  lightningLast,
  lightningNearest,
  lightningNewPlace,
  lightningNewest,
  lookName,
} from '../../features/onwater/lightningWatch.ts';
import { distKm } from '../../lib/geo.ts';
import { state } from '../../state/index.ts';

/** The flashes are read again this often: a new image every 5 minutes. */
const REFRESH_MS = 5 * 60_000;
/** One image every 5 minutes. */
const STEP_MS = 5 * 60_000;
/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 500;
/**
 * The images shown, as in Blitzortung: the newest bright, those of 10 and
 * 20 minutes before fainter, so a storm shows where it goes.
 */
const TRAIL = [
  { back: 4, opacity: 0.3 },
  { back: 2, opacity: 0.55 },
  { back: 0, opacity: 0.95 },
] as const;

function stamp(time: number): string {
  return new Date(time).toISOString().replace('.000Z', 'Z');
}

/**
 * An image of the flashes with the black of no data made clear: the server
 * lays black bands where the satellite stops seeing (the far north).
 * @param source - The image read.
 * @returns The image cleaned, as a data URL.
 */
function cleaned(source: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) return source.src;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  if (lightningClearNoData(image.data) === 0) return source.src;
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * The WMS layer whose tiles come cleaned of the black of no data.
 * @returns Its class.
 */
function cleanWms() {
  const L = leaflet();
  return class CleanWms extends L.TileLayer.WMS {
    override createTile(coords: Coords, done: DoneCallback): HTMLElement {
      const tile = document.createElement('img');
      tile.alt = '';
      tile.setAttribute('role', 'presentation');
      const source = new Image();
      source.crossOrigin = 'anonymous';
      tile.addEventListener('load', () => done(undefined, tile));
      tile.addEventListener('error', () => done(new Error('tile'), tile));
      source.addEventListener('load', () => {
        try {
          tile.src = cleaned(source);
        } catch {
          tile.src = source.src;
        }
      });
      source.addEventListener('error', () => done(new Error('tile'), tile));
      source.src = this.getTileUrl(coords);
      return tile;
    }
  };
}

/** The place looked from is checked this often. */
const CHECK_MS = 3000;
/** Moved this far, the storm is looked for again from the new place, km. */
const MOVED_KM = 10;
/** A storm read longer ago than this is not shown by its arrow. */
const AIM_FRESH_MS = 30 * 60_000;
/** The arrow of the motion of a storm: where it is in this time. */
const MOTION_MS = 30 * 60_000;

/**
 * The storm to aim at: the newest report with flashes (the look of the
 * alert, or the nearest storm of Météo › Alerte foudre).
 * @param now - Epoch ms.
 * @returns The report, or null.
 */
function aimed(now: number): LightningReport | null {
  const found = [lightningLast.peek(), lightningNearest.peek()?.report ?? null]
    .filter(
      (one): one is LightningReport =>
        one?.nearestKm != null &&
        one.bearing != null &&
        one.place != null &&
        now - one.readAt < AIM_FRESH_MS,
    )
    .toSorted((a, b) => (a.nearestKm ?? 0) - (b.nearestKm ?? 0));
  return found[0] ?? null;
}

/**
 * An arrow head at a point, turned to a bearing.
 * @param degrees - From north.
 * @param kind - Its class: the aim (yellow) or the motion (red).
 * @returns The HTML.
 */
function headHtml(degrees: number, kind: string): string {
  return `<svg class="lightning-head ${kind}" viewBox="-10 -10 20 20" style="transform:rotate(${Math.round(degrees)}deg)"><path d="M0-9 7 7 0 3-7 7z"/></svg>`;
}

/** The gap between a point and its label, in pixels. */
const TAG_GAP = 16;

/**
 * A label on the map, wholly on one side of its point (towards a bearing),
 * so that two labels on either side never cover each other.
 * @param layer - Where it is drawn.
 * @param at - Where.
 * @param html - What it says.
 * @param kind - Its class: the aim, the motion.
 * @param side - The bearing of the side it stands on; none: centred above.
 */
function tag(
  layer: LayerGroup,
  at: { lat: number; lon: number },
  html: string,
  kind: string,
  side?: number,
): void {
  const L = leaflet();
  let style = '';
  if (side != null) {
    const rad = (side * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const most = Math.max(Math.abs(dx), Math.abs(dy));
    const ux = dx / most;
    const uy = dy / most;
    style = ` style="left:0;top:0;transform:translate(calc(${(-50 + ux * 50).toFixed(1)}% + ${(dx * TAG_GAP).toFixed(1)}px),calc(${(-50 + uy * 50).toFixed(1)}% + ${(dy * TAG_GAP).toFixed(1)}px))"`;
  }
  L.marker([at.lat, at.lon], {
    icon: L.divIcon({
      className: 'lightning-tag-wrap',
      html: `<div class="lightning-tag ${kind}"${style}>${html}</div>`,
      iconSize: [0, 0],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 800,
  }).addTo(layer);
}

/**
 * The side of the label of the yellow arrow: ahead, towards the storm (away
 * from the label of the place), and on the side away from the red vector.
 * @param bearing - Of the storm.
 * @param toward - Where the storm goes, or null.
 * @returns Degrees.
 */
function aimSide(bearing: number, toward: number | null): number {
  const right =
    toward != null && Math.sin(((toward - bearing) * Math.PI) / 180) > 0;
  return bearing + (right ? -60 : 60);
}

/**
 * The yellow arrow from where NavIn looks from (the GPS, or the zone chosen:
 * Atlantique, Méditerranée, Lacs), marked and named, to the nearest storm,
 * its distance and bearing in the middle; from the storm the red vector of
 * its motion (course, speed, 30 minutes long), and when it is on the boat.
 * @param layer - Where it is drawn.
 * @param report - The storm.
 */
function drawAim(layer: LayerGroup, report: LightningReport): void {
  const L = leaflet();
  const { place, nearestKm, bearing, motion } = report;
  if (!place || nearestKm == null || bearing == null) return;
  const storm = pointAt(place.lat, place.lon, bearing, nearestKm);
  const line: Array<[number, number]> = [
    [place.lat, place.lon],
    [storm.lat, storm.lon],
  ];
  L.polyline(line, {
    className: 'lightning-aim-case',
    weight: 7,
    interactive: false,
  }).addTo(layer);
  L.polyline(line, {
    className: 'lightning-aim-line',
    weight: 3,
    dashArray: '10 8',
    interactive: false,
  }).addTo(layer);
  // Where NavIn looks from (my position or the zone): a point above the
  // flashes and everything, the start of the yellow arrow; no label.
  L.marker([place.lat, place.lon], {
    icon: L.divIcon({
      className: 'lightning-me-wrap',
      html: '<div class="lightning-me" data-lightning="me"></div>',
      iconSize: [0, 0],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 900,
  }).addTo(layer);
  L.marker([storm.lat, storm.lon], {
    icon: L.divIcon({
      className: 'lightning-head-wrap',
      html: headHtml(bearing, 'aim'),
      iconSize: [0, 0],
    }),
    interactive: false,
    keyboard: false,
  }).addTo(layer);
  // The distance and the bearing in the middle of the yellow arrow.
  const middle = pointAt(place.lat, place.lon, bearing, nearestKm / 2);
  const now = Date.now();
  const words = [
    `⚡ ${nmOf(nearestKm)} NM au ${pointOf(bearing)} (${degreesText(bearing)})`,
  ];
  if (motion && motion.closingKn >= 2) {
    words.push(`se rapproche à ${Math.round(motion.closingKn)} nd`);
  } else if (motion && motion.closingKn <= -2) {
    words.push(`s’éloigne à ${Math.round(-motion.closingKn)} nd`);
  }
  const eta = lightningEta(report, now);
  if (eta?.onUs) {
    words.push('⚠️ sur vous');
  } else if (eta?.etaAt != null) {
    const warn = lightningEtaShown(eta, now) ? '⚠️ ' : '';
    words.push(`${warn}sur vous vers ${hourText(eta.etaAt)}`);
  }
  // No red vector: said in the same label, not over it.
  if (motion?.towardDeg == null || motion.speedKn == null) {
    words.push(
      motion?.speedKn == null
        ? 'déplacement pas encore connu'
        : 'l’orage reste sur place',
    );
  }
  tag(
    layer,
    middle,
    words.map((word) => `<div>${word}</div>`).join(''),
    'aim',
    aimSide(bearing, motion?.towardDeg ?? null),
  );
  // The red vector: where the storm goes, from the storm, 30 minutes long.
  if (motion?.towardDeg != null && motion.speedKn != null) {
    const ahead = pointAt(
      storm.lat,
      storm.lon,
      motion.towardDeg,
      Math.max(3, (motion.speedKn * 1.852 * MOTION_MS) / 3_600_000),
    );
    L.polyline(
      [
        [storm.lat, storm.lon],
        [ahead.lat, ahead.lon],
      ],
      { className: 'lightning-move-case', weight: 8, interactive: false },
    ).addTo(layer);
    L.polyline(
      [
        [storm.lat, storm.lon],
        [ahead.lat, ahead.lon],
      ],
      { className: 'lightning-move-line', weight: 4, interactive: false },
    ).addTo(layer);
    L.marker([ahead.lat, ahead.lon], {
      icon: L.divIcon({
        className: 'lightning-head-wrap',
        html: headHtml(motion.towardDeg, 'move'),
        iconSize: [0, 0],
      }),
      interactive: false,
      keyboard: false,
    }).addTo(layer);
    tag(
      layer,
      ahead,
      `déplacement ${degreesText(motion.towardDeg)} · ${Math.round(motion.speedKn)} nd`,
      'move',
      motion.towardDeg,
    );
  }
}

/**
 * The arrow to the nearest storm on the NavIn map (with the flashes).
 * @returns Nothing: it draws on the map.
 */
function LightningAim() {
  useSignals();
  const last = lightningLast.value;
  const nearest = lightningNearest.value;
  // Another place to look from (another zone, the GPS again, the boat gone
  // on): the storm is looked for again from there; moving the map does not.
  useEffect(() => {
    const timer = setInterval(() => {
      const report = aimed(Date.now());
      if (!report?.place) return;
      const here = alertPlace();
      if (
        report.placeName !== lookName() ||
        distKm(report.place.lat, report.place.lon, here.lat, here.lon) >
          MOVED_KM
      ) {
        lightningNewPlace();
      }
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const report = aimed(Date.now());
    if (!report) return undefined;
    let closed = false;
    let layer: LayerGroup | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      if (closed) return;
      const map = tracker.current?.map;
      if (!map) {
        wait = setTimeout(draw, WAIT_MS);
        return;
      }
      layer = leaflet().layerGroup().addTo(map);
      drawAim(layer, report);
    };
    draw();
    return () => {
      closed = true;
      clearTimeout(wait);
      layer?.remove();
    };
  }, [last, nearest]);
  return null;
}

/**
 * The lightning seen by the satellite MTG on the NavIn map, always, with
 * nothing to ask: nothing shows where there is none. The last 20 minutes,
 * the newest brightest; yellow 1 flash in 5 minutes, dark red 20 and more.
 * @returns Nothing: it draws on the map.
 */
export function LightningOnMap() {
  useSignals();
  const on = lightningOnMap(
    state.preferences.settings.value.lightning as LightningSettings | undefined,
  );
  useEffect(() => {
    if (!on) return undefined;
    let closed = false;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const layers: TileLayer.WMS[] = [];
    const times = () => {
      const now = Date.now();
      const newest = lightningNewest() ?? lightningTimes(now)[0] ?? now;
      return TRAIL.map(({ back }) => stamp(newest - back * STEP_MS));
    };
    const start = () => {
      if (closed) return;
      const map = tracker.current?.map;
      if (!map) {
        wait = setTimeout(start, WAIT_MS);
        return;
      }
      const Wms = cleanWms();
      const shown = times();
      for (const [index, { opacity }] of TRAIL.entries()) {
        layers.push(
          new Wms(LIGHTNING_WMS, {
            layers: LIGHTNING_LAYER,
            format: 'image/png',
            transparent: true,
            opacity,
            className: 'map-flashes',
            attribution: 'Éclairs : EUMETSAT MTG',
            time: shown[index],
          } as never).addTo(map),
        );
      }
    };
    start();
    const timer = setInterval(() => {
      const shown = times();
      for (const [index, layer] of layers.entries()) {
        layer.setParams({ time: shown[index] } as never);
      }
    }, REFRESH_MS);
    return () => {
      closed = true;
      clearTimeout(wait);
      clearInterval(timer);
      for (const layer of layers) layer.remove();
    };
  }, [on]);
  return on ? <LightningAim /> : null;
}
