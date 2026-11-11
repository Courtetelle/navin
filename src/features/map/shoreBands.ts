import type { Layer, Map as LeafletMap } from 'leaflet';

import { rad } from '../../lib/geo.ts';

import type { LatLngPair } from './constants.ts';
import { leaflet } from './leaflet.ts';
import { canvasOutdated, frameCanvas } from './overlayCanvas.ts';
import { inShore, shoreDist, zonePopupHtml } from './shore.ts';

/** The shore of the lake shown on each map, for the information of a point. */
const shoreOf = new WeakMap<LeafletMap, readonly LatLngPair[][]>();

/**
 * The rules of the shore band a point is in, for the information of the
 * point (the cross of a tap).
 * @param map - The map.
 * @param lat - Latitude of the point.
 * @param lon - Its longitude.
 * @returns The rules, in HTML, or `null` outside the bands.
 */
export function shoreNoteAt(
  map: LeafletMap,
  lat: number,
  lon: number,
): string | null {
  const rings = shoreOf.get(map);
  if (!rings || !inShore(rings, lat, lon)) return null;
  const distance = shoreDist(rings, lat, lon);
  return distance < 300 ? zonePopupHtml(distance) : null;
}

/**
 * Canvas layer of the 150 m and 300 m bands along the shore; the information
 * of a point gives the rules of its band (legacy `newShoreBands`).
 * @param rings - Lake rings.
 * @returns The layer.
 */
export function newShoreBands(rings: readonly LatLngPair[][]): Layer {
  const L = leaflet();
  class ShoreBands extends L.Layer {
    private canvas: HTMLCanvasElement | null = null;

    override onAdd(map: LeafletMap): this {
      this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide shore-bands');
      this.canvas.style.pointerEvents = 'none';
      map.getPanes().overlayPane.append(this.canvas);
      map.on('moveend zoomend resize viewreset', this.redraw);
      shoreOf.set(map, rings);
      this.redraw();
      return this;
    }

    override onRemove(map: LeafletMap): this {
      if (this.canvas) L.DomUtil.remove(this.canvas);
      map.off('moveend zoomend resize viewreset', this.redraw);
      shoreOf.delete(map);
      return this;
    }

    private readonly redraw = (): void => {
      if (this.canvas && canvasOutdated(this._map, this.canvas)) {
        drawBands(this._map, this.canvas, rings);
      }
    };
  }
  return new ShoreBands();
}

function drawBands(
  map: LeafletMap,
  canvas: HTMLCanvasElement,
  rings: readonly LatLngPair[][],
): void {
  const frame = frameCanvas(map, canvas);
  if (!frame) return;
  const { context, toCanvas } = frame;
  const path = new Path2D();
  for (const ring of rings) {
    for (const [index, position] of ring.entries()) {
      const point = toCanvas(position);
      if (index) path.lineTo(point.x, point.y);
      else path.moveTo(point.x, point.y);
    }
    path.closePath();
  }
  const metresPerPixel =
    (40_075_016.686 * Math.cos(rad(map.getCenter().lat))) /
    (256 * 2 ** map.getZoom());
  context.save();
  context.clip(path, 'evenodd');
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(255, 150, 0, 0.30)';
  context.lineWidth = 600 / metresPerPixel;
  context.stroke(path);
  context.strokeStyle = 'rgba(220, 0, 0, 0.30)';
  context.lineWidth = 300 / metresPerPixel;
  context.stroke(path);
  context.restore();
}
