import type { Layer, LeafletMouseEvent, Map as LeafletMap } from 'leaflet';

import { rad } from '../../lib/geo.ts';

import type { LatLngPair } from './constants.ts';
import { leaflet } from './leaflet.ts';
import { canvasOutdated, frameCanvas } from './overlayCanvas.ts';
import { inShore, shoreDist, zonePopupHtml } from './shore.ts';

/** How the shore zones are drawn. */
export type ShoreStyle = 'bands' | 'dashed';

/**
 * Canvas layer of the shore zones: the 150 m and 300 m bands, or only the
 * 300 m limit as a dashed line; a tap within 300 m gives the rules (legacy
 * `newShoreBands`).
 * @param rings - Lake rings.
 * @param style - Bands, or the dashed 300 m limit.
 * @returns The layer.
 */
export function newShoreBands(
  rings: readonly LatLngPair[][],
  style: ShoreStyle = 'bands',
): Layer {
  const L = leaflet();
  class ShoreBands extends L.Layer {
    private canvas: HTMLCanvasElement | null = null;

    override onAdd(map: LeafletMap): this {
      this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide shore-bands');
      this.canvas.style.pointerEvents = 'none';
      map.getPanes().overlayPane.append(this.canvas);
      map.on('moveend zoomend resize viewreset', this.redraw);
      map.on('click', this.onTap);
      this.redraw();
      return this;
    }

    override onRemove(map: LeafletMap): this {
      if (this.canvas) L.DomUtil.remove(this.canvas);
      map.off('moveend zoomend resize viewreset', this.redraw);
      map.off('click', this.onTap);
      return this;
    }

    private readonly redraw = (): void => {
      if (this.canvas && canvasOutdated(this._map, this.canvas)) {
        if (style === 'bands') drawBands(this._map, this.canvas, rings);
        else drawLimit(this._map, this.canvas, rings);
      }
    };

    private readonly onTap = (event: LeafletMouseEvent): void => {
      const { lat, lng } = event.latlng;
      if (!inShore(rings, lat, lng)) return;
      const distance = shoreDist(rings, lat, lng);
      if (distance >= 300) return;
      L.popup({ maxWidth: 300 })
        .setLatLng(event.latlng)
        .setContent(zonePopupHtml(distance))
        .openOn(this._map);
    };
  }
  return new ShoreBands();
}

function shorePath(
  rings: readonly LatLngPair[][],
  toCanvas: (position: LatLngPair) => { x: number; y: number },
): Path2D {
  const path = new Path2D();
  for (const ring of rings) {
    for (const [index, position] of ring.entries()) {
      const point = toCanvas(position);
      if (index) path.lineTo(point.x, point.y);
      else path.moveTo(point.x, point.y);
    }
    path.closePath();
  }
  return path;
}

function metresPerPixel(map: LeafletMap): number {
  return (
    (40_075_016.686 * Math.cos(rad(map.getCenter().lat))) /
    (256 * 2 ** map.getZoom())
  );
}

function drawBands(
  map: LeafletMap,
  canvas: HTMLCanvasElement,
  rings: readonly LatLngPair[][],
): void {
  const frame = frameCanvas(map, canvas);
  if (!frame) return;
  const { context, toCanvas } = frame;
  const path = shorePath(rings, toCanvas);
  const perPixel = metresPerPixel(map);
  context.save();
  context.clip(path, 'evenodd');
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(255, 150, 0, 0.30)';
  context.lineWidth = 600 / perPixel;
  context.stroke(path);
  context.strokeStyle = 'rgba(220, 0, 0, 0.30)';
  context.lineWidth = 300 / perPixel;
  context.stroke(path);
  context.restore();
}

/** Line width of the 300 m limit, and length of its dashes, in pixels. */
const LIMIT_PX = 2.5;
const DASH_PX = 7;

/**
 * The 300 m limit alone, dashed: the edge of a 300 m band drawn apart, cut
 * into dashes by a checkerboard (dashes whatever the direction of the line).
 * @param map - The map.
 * @param canvas - The layer canvas.
 * @param rings - Lake rings.
 */
function drawLimit(
  map: LeafletMap,
  canvas: HTMLCanvasElement,
  rings: readonly LatLngPair[][],
): void {
  const frame = frameCanvas(map, canvas);
  if (!frame) return;
  const { context, toCanvas } = frame;
  const width = 600 / metresPerPixel(map);
  if (width < 3 * LIMIT_PX) return;
  const work = document.createElement('canvas');
  work.width = canvas.width;
  work.height = canvas.height;
  const pen = work.getContext('2d');
  if (!pen) return;
  pen.setTransform(context.getTransform());
  const path = shorePath(rings, toCanvas);
  pen.clip(path, 'evenodd');
  pen.lineJoin = 'round';
  pen.lineCap = 'round';
  pen.strokeStyle = '#c80000';
  pen.lineWidth = width + LIMIT_PX;
  pen.stroke(path);
  pen.globalCompositeOperation = 'destination-out';
  pen.lineWidth = width - LIMIT_PX;
  pen.stroke(path);
  pen.resetTransform();
  pen.globalCompositeOperation = 'destination-in';
  const scale = canvas.width / (canvas.clientWidth || canvas.width);
  const cell = Math.round(DASH_PX * scale);
  const tile = document.createElement('canvas');
  tile.width = 2 * cell;
  tile.height = 2 * cell;
  const tilePen = tile.getContext('2d');
  if (!tilePen) return;
  tilePen.fillRect(0, 0, cell, cell);
  tilePen.fillRect(cell, cell, cell, cell);
  const pattern = pen.createPattern(tile, 'repeat');
  if (!pattern) return;
  pen.fillStyle = pattern;
  pen.fillRect(0, 0, work.width, work.height);
  context.save();
  context.resetTransform();
  context.drawImage(work, 0, 0);
  context.restore();
}
