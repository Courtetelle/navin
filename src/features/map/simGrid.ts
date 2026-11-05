import type { Map as LeafletMap } from 'leaflet';

import type { TileContext } from './simTile.ts';

/** Size of a tile in pixels. */
export const TILE = 256;

function gridStep(zoom: number): number {
  if (zoom >= 15) return 1 / 120;
  if (zoom >= 13) return 1 / 30;
  if (zoom >= 11) return 1 / 12;
  return zoom >= 9 ? 1 / 4 : 1;
}

function gridLabel(value: number, step: number): string {
  const degrees = Math.floor(Math.abs(value));
  const minutes = (Math.abs(value) - degrees) * 60;
  const text = minutes.toFixed(step < 1 / 60 ? 1 : 0).padStart(2, '0');
  return `${degrees}°${text}′`;
}

/**
 * Lat / lon grid of a tile, its step following the zoom, with graduations.
 * @param context - Tile being drawn.
 * @param map - Leaflet map.
 * @param originX - Left of the tile in map pixels.
 * @param originY - Top of the tile in map pixels.
 */
export function drawGrid(
  { graphics, palette, zoom, toTile }: TileContext,
  map: LeafletMap,
  originX: number,
  originY: number,
): void {
  const step = gridStep(zoom);
  const northWest = map.unproject([originX, originY], zoom);
  const southEast = map.unproject([originX + TILE, originY + TILE], zoom);
  graphics.strokeStyle = palette.grid;
  graphics.lineWidth = 1;
  graphics.fillStyle = palette.text;
  graphics.font = '10px sans-serif';
  const firstLat = Math.ceil(southEast.lat / step) * step;
  for (let lat = firstLat; lat <= northWest.lat; lat += step) {
    const [, y] = toTile(lat, northWest.lng);
    graphics.beginPath();
    graphics.moveTo(0, y);
    graphics.lineTo(TILE, y);
    graphics.stroke();
    graphics.fillText(`${gridLabel(lat, step)} N`, 3, y - 3);
  }
  const firstLon = Math.ceil(northWest.lng / step) * step;
  for (let lon = firstLon; lon <= southEast.lng; lon += step) {
    const [x] = toTile(northWest.lat, lon);
    graphics.beginPath();
    graphics.moveTo(x, 0);
    graphics.lineTo(x, TILE);
    graphics.stroke();
    graphics.fillText(`${gridLabel(lon, step)} E`, x + 3, 12);
  }
}
