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
  hourText,
  lightningClearNoData,
  lightningEta,
  lightningOnMap,
  lightningTimes,
  nmOf,
  pointAt,
  pointOf,
} from '../../features/onwater/lightning.ts';
import {
  lightningLast,
  lightningNearest,
} from '../../features/onwater/lightningWatch.ts';
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

/**
 * The arrow from the boat (or the zone) to the nearest storm, its distance
 * and where it is; from the storm a red arrow to where it goes in 30
 * minutes, its speed, and when it is on the boat.
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
  L.marker([storm.lat, storm.lon], {
    icon: L.divIcon({
      className: 'lightning-head-wrap',
      html: headHtml(bearing, 'aim'),
      iconSize: [0, 0],
    }),
    interactive: false,
    keyboard: false,
  }).addTo(layer);
  const now = Date.now();
  const words = [
    `⚡ ${nmOf(nearestKm)} NM au ${pointOf(bearing)} (${String(Math.round(bearing) % 360).padStart(3, '0')}°)`,
  ];
  if (motion?.towardDeg != null && motion.speedKn != null) {
    const ahead = pointAt(
      storm.lat,
      storm.lon,
      motion.towardDeg,
      (motion.speedKn * 1.852 * MOTION_MS) / 3_600_000,
    );
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
    // Its own label at the tip of the vector: where the storm goes.
    const course = String(Math.round(motion.towardDeg) % 360).padStart(3, '0');
    L.marker([ahead.lat, ahead.lon], {
      icon: L.divIcon({
        className: 'lightning-tag-wrap',
        html: `<div class="lightning-tag move">déplacement ${course}° · ${Math.round(motion.speedKn)} nd</div>`,
        iconSize: [0, 0],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 800,
    }).addTo(layer);
  }
  if (motion && motion.closingKn >= 2) {
    words.push(`se rapproche à ${Math.round(motion.closingKn)} nd`);
  }
  const eta = lightningEta(report, now);
  if (eta?.onUs) {
    words.push('⚠️ sur vous');
  } else if (eta?.etaAt != null) {
    words.push(`⚠️ sur vous vers ${hourText(eta.etaAt)}`);
  }
  L.marker([storm.lat, storm.lon], {
    icon: L.divIcon({
      className: 'lightning-tag-wrap',
      html: `<div class="lightning-tag">${words.map((word) => `<div>${word}</div>`).join('')}</div>`,
      iconSize: [0, 0],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 800,
  }).addTo(layer);
}

/**
 * The arrow to the nearest storm on the NavIn map (with the flashes).
 * @returns Nothing: it draws on the map.
 */
function LightningAim() {
  useSignals();
  const last = lightningLast.value;
  const nearest = lightningNearest.value;
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
      const newest = lightningTimes(now)[0] ?? now;
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
