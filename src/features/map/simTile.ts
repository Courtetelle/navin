import type { Coords, Map as LeafletMap } from 'leaflet';

import { SIM_LEMAN_SMOOTH, SIM_MED_SMOOTH } from './simChartData.ts';
import { TILE, drawGrid } from './simGrid.ts';

const EARTH_METRES = 40_075_016;

/** Colours of the chart. */
export interface Palette {
  sea: string;
  land: string;
  near: string;
  middle: string;
  shore: string;
  grid: string;
  text: string;
  water: string;
}

const NIGHT: Palette = {
  sea: '#0d2236',
  land: '#3a3020',
  near: '#2e5f86',
  middle: '#1a3d5c',
  shore: '#f0d080',
  grid: 'rgba(230,220,150,.45)',
  text: 'rgba(240,230,170,.95)',
  water: 'rgba(150,200,255,.9)',
};
const DAY: Palette = {
  sea: '#fdfdf8',
  land: '#f3e3ac',
  near: '#93cdec',
  middle: '#c9e6f6',
  shore: '#5a4a2a',
  grid: 'rgba(70,90,120,.35)',
  text: 'rgba(50,70,100,.8)',
  water: 'rgba(40,90,150,.7)',
};

/** Pixels in the tile. */
export type TilePoint = [number, number];

/** What the drawing steps of a tile share. */
export interface TileContext {
  graphics: CanvasRenderingContext2D;
  palette: Palette;
  zoom: number;
  night: boolean;
  /** Geographic position to tile pixels. */
  toTile: (lat: number, lon: number) => TilePoint;
}

/**
 * Draw one tile of the simulated chart: sand land, water in three tints that
 * follow the distance to the shore (never real depths), lat / lon grid.
 * @param map - Leaflet map.
 * @param coords - Tile.
 * @returns The canvas.
 */
export function drawSimTile(
  map: LeafletMap,
  coords: Coords,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const graphics = canvas.getContext('2d') as CanvasRenderingContext2D;
  const zoom = coords.z;
  const originX = coords.x * TILE;
  const originY = coords.y * TILE;
  const night = document.documentElement.dataset.theme === 'night';
  const toTile = (lat: number, lon: number): TilePoint => {
    const point = map.project([lat, lon], zoom);
    return [point.x - originX, point.y - originY];
  };
  const context = {
    graphics,
    palette: night ? NIGHT : DAY,
    zoom,
    night,
    toTile,
  };
  drawLeman(context);
  drawMediterranean(context);
  drawGrid(context, map, originX, originY);
  return canvas;
}

function extent(points: readonly TilePoint[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY };
}

function tracePath(
  graphics: CanvasRenderingContext2D,
  points: readonly TilePoint[],
): void {
  graphics.beginPath();
  for (const [index, [x, y]] of points.entries()) {
    if (index) graphics.lineTo(x, y);
    else graphics.moveTo(x, y);
  }
  graphics.closePath();
}

function shoreWidth(zoom: number, night: boolean): number {
  if (zoom >= 13) return night ? 2.2 : 1.6;
  return night ? 1.5 : 1;
}

function metresPerPixel(latitude: number, zoom: number): number {
  return (
    (EARTH_METRES * Math.cos((latitude * Math.PI) / 180)) / (256 * 2 ** zoom)
  );
}

function drawLeman(context: TileContext): void {
  const { graphics, palette, zoom, night, toTile } = context;
  const lake = SIM_LEMAN_SMOOTH.map(([lat, lon]) => toTile(lat, lon));
  const { minX, maxX, minY, maxY } = extent(lake);
  const margin = (maxX - minX) * 0.6;
  const near =
    maxX > -margin &&
    minX < TILE + margin &&
    maxY > -margin &&
    minY < TILE + margin;
  if (!near) {
    graphics.fillStyle = palette.sea;
    graphics.fillRect(0, 0, TILE, TILE);
    return;
  }
  graphics.fillStyle = palette.land;
  graphics.fillRect(0, 0, TILE, TILE);
  graphics.save();
  tracePath(graphics, lake);
  graphics.clip();
  graphics.fillStyle = palette.sea;
  graphics.fillRect(0, 0, TILE, TILE);
  // The shore drawn in thick strokes, cut inside the lake, gives the water tints.
  const scale = metresPerPixel(46.4, zoom);
  graphics.lineJoin = 'round';
  const bands: Array<[number, string]> = [
    [1200, palette.middle],
    [300, palette.near],
  ];
  for (const [metres, colour] of bands) {
    tracePath(graphics, lake);
    graphics.strokeStyle = colour;
    graphics.lineWidth = (2 * metres) / scale;
    graphics.stroke();
  }
  graphics.restore();
  tracePath(graphics, lake);
  graphics.strokeStyle = palette.shore;
  graphics.lineWidth = shoreWidth(zoom, night);
  graphics.stroke();
  if (zoom >= 9 && zoom <= 12) {
    const [x, y] = toTile(46.44, 6.56);
    if (x > -80 && x < TILE + 80 && y > -20 && y < TILE + 20) {
      drawWaterName(context, 'L É M A N', `italic ${zoom * 2}px serif`, x, y);
    }
  }
}

function drawWaterName(
  { graphics, palette }: TileContext,
  name: string,
  font: string,
  x: number,
  y: number,
): void {
  graphics.font = font;
  graphics.fillStyle = palette.water;
  graphics.textAlign = 'center';
  graphics.fillText(name, x, y);
  graphics.textAlign = 'left';
}

function drawMediterranean(context: TileContext): void {
  const { graphics, palette, zoom, night, toTile } = context;
  const rings = SIM_MED_SMOOTH.map((ring) =>
    ring.map(([lat, lon]) => toTile(lat, lon)),
  );
  const { minX, maxX, minY, maxY } = extent(rings[0] as TilePoint[]);
  const inView =
    maxX > -TILE &&
    minX < 2 * TILE &&
    maxY > -TILE &&
    minY < 2 * TILE + (maxY - minY) * 0.4;
  if (!inView) return;
  const scale = metresPerPixel(43.1, zoom);
  graphics.lineJoin = 'round';
  const bands: Array<[number, string]> = [
    [2500, palette.middle],
    [600, palette.near],
  ];
  for (const [metres, colour] of bands) {
    for (const ring of rings) {
      tracePath(graphics, ring);
      graphics.strokeStyle = colour;
      graphics.lineWidth = (2 * metres) / scale;
      graphics.stroke();
    }
  }
  for (const ring of rings) {
    tracePath(graphics, ring);
    graphics.fillStyle = palette.land;
    graphics.fill();
    graphics.strokeStyle = palette.shore;
    graphics.lineWidth = shoreWidth(zoom, night);
    graphics.stroke();
  }
  if (zoom >= 8 && zoom <= 11) {
    const [x, y] = toTile(42.88, 5.95);
    if (x > -200 && x < TILE + 200 && y > -20 && y < TILE + 20) {
      drawWaterName(
        context,
        'M É D I T E R R A N É E',
        `italic ${zoom * 2.2}px serif`,
        x,
        y,
      );
    }
  }
}
