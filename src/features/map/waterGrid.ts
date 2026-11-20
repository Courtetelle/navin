import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { PMTiles } from 'pmtiles';

import { offlineMapCovers } from './offlineMapLayer.ts';
import type { OfflineMap } from './offlineMapStore.ts';
import { offlineMapSource, offlineMaps } from './offlineMapStore.ts';
import type { WaterGrid } from './waterRoute.ts';
import {
  blockCircle,
  cellMetres,
  keepOffShore,
  worldPixel,
} from './waterRoute.ts';

/** At most this many cells across or down: the time of the search on a phone. */
const MOST_CELLS = 900;
/** Cells never finer than this zoom (about 2 m). */
const TOP_ZOOM = 16;

/** A round zone the route goes around. */
export interface AvoidZone {
  lat: number;
  lon: number;
  /** Radius, metres. */
  m: number;
}

/** A box in degrees. */
export interface Box {
  s: number;
  n: number;
  w: number;
  e: number;
}

/** What the grid is made for. */
export interface GridAsk extends Box {
  /** The points of the route: the map file must cover them. */
  inner: Box;
  /** Least distance to the shore, metres. */
  marginM: number;
  avoid: readonly AvoidZone[];
}

/** The grid, or why there is none. */
export type GridAnswer =
  | {
      kind: 'grid';
      grid: WaterGrid;
      /** The same water with half the margin. */
      loose: WaterGrid;
      map: OfflineMap;
      missingTiles: number;
    }
  | { kind: 'no-map' }
  | { kind: 'no-water'; map: OfflineMap };

/**
 * The map file of the device that covers a whole box.
 * @param box - The box.
 * @returns The map, or `undefined`.
 */
async function coveringMap(box: Box): Promise<OfflineMap | undefined> {
  const maps = await offlineMaps();
  return maps
    .filter(
      (map) =>
        offlineMapCovers(map, box.s, box.w) &&
        offlineMapCovers(map, box.n, box.e),
    )
    .toSorted((a, b) => b.maxZoom - a.maxZoom)[0];
}

/**
 * The zoom whose pixels are the cells: the finest that keeps the box under
 * {@link MOST_CELLS} cells a side.
 * @param ask - The box.
 * @returns The zoom.
 */
export function gridZoom(ask: Box): number {
  for (let zoom = TOP_ZOOM; zoom > 4; zoom--) {
    const [x0, y0] = worldPixel(ask.n, ask.w, zoom);
    const [x1, y1] = worldPixel(ask.s, ask.e, zoom);
    if (x1 - x0 <= MOST_CELLS && y1 - y0 <= MOST_CELLS) return zoom;
  }
  return 4;
}

/**
 * Draw the water of the map file of the device on a grid over the box: the
 * `water` layer of its tiles (sea, lakes, rivers), the margin to the shore
 * taken away, and the zones to avoid.
 * @param ask - Box, margin and zones.
 * @returns The grid, or why there is none.
 */
export async function buildWaterGrid(asked: GridAsk): Promise<GridAnswer> {
  const map = await coveringMap(asked.inner);
  if (!map) return { kind: 'no-map' };
  // The room around the route, within the map.
  const ask = {
    ...asked,
    s: Math.max(asked.s, map.south),
    n: Math.min(asked.n, map.north),
    w: Math.max(asked.w, map.west),
    e: Math.min(asked.e, map.east),
  };
  const zoom = gridZoom(ask);
  const dataZoom = Math.min(zoom, map.maxZoom);
  const scale = 2 ** (zoom - dataZoom) * 256;
  const [nwX, nwY] = worldPixel(ask.n, ask.w, zoom);
  const [seX, seY] = worldPixel(ask.s, ask.e, zoom);
  const x0 = Math.floor(nwX);
  const y0 = Math.floor(nwY);
  const w = Math.ceil(seX) - x0;
  const h = Math.ceil(seY) - y0;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { kind: 'no-water', map };
  context.fillStyle = '#000';
  const reader = new PMTiles(offlineMapSource(map));
  let missingTiles = 0;
  const firstX = Math.floor(x0 / scale);
  const lastX = Math.floor((x0 + w) / scale);
  const firstY = Math.floor(y0 / scale);
  const lastY = Math.floor((y0 + h) / scale);
  /* eslint-disable no-await-in-loop -- one tile in memory at a time */
  for (let tx = firstX; tx <= lastX; tx++) {
    for (let ty = firstY; ty <= lastY; ty++) {
      const found = await reader.getZxy(dataZoom, tx, ty).catch(() => null);
      if (!found) {
        missingTiles++;
        continue;
      }
      const layer = new VectorTile(new Pbf(new Uint8Array(found.data))).layers
        .water;
      for (let index = 0; index < (layer?.length ?? 0); index++) {
        const feature = layer?.feature(index);
        // Areas only: lines are rivers too narrow for a boat.
        if (feature?.type !== 3) continue;
        const ratio = scale / feature.extent;
        context.beginPath();
        for (const ring of feature.loadGeometry()) {
          for (const [rank, point] of ring.entries()) {
            const x = tx * scale + point.x * ratio - x0;
            const y = ty * scale + point.y * ratio - y0;
            if (rank === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          }
          context.closePath();
        }
        context.fill('evenodd');
      }
    }
  }
  /* eslint-enable no-await-in-loop */
  const pixels = context.getImageData(0, 0, w, h).data;
  const water = new Uint8Array(w * h);
  let wet = 0;
  for (let index = 0; index < water.length; index++) {
    if ((pixels[index * 4 + 3] as number) > 127) {
      water[index] = 1;
      wet++;
    }
  }
  if (wet === 0) return { kind: 'no-water', map };
  const middle = (ask.s + ask.n) / 2;
  const raw: WaterGrid = { w, h, water, x0, y0, zoom };
  const cells = ask.marginM / cellMetres(zoom, middle);
  const grid = keepOffShore(raw, cells);
  const loose = keepOffShore(raw, cells / 2);
  for (const zone of ask.avoid) {
    blockCircle(grid, zone.lat, zone.lon, zone.m);
    blockCircle(loose, zone.lat, zone.lon, zone.m);
  }
  return { kind: 'grid', grid, loose, map, missingTiles };
}
