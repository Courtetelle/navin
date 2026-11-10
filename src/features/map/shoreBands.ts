import type { Layer, LeafletMouseEvent, Map as LeafletMap } from 'leaflet';

import { rad } from '../../lib/geo.ts';

import type { LatLngPair } from './constants.ts';
import { leaflet } from './leaflet.ts';
import { canvasOutdated, frameCanvas } from './overlayCanvas.ts';
import { inShore, shoreDist, zonePopupHtml } from './shore.ts';

/**
 * Canvas layer of the 150 m and 300 m bands along the shore; a tap in a band
 * gives its rules (legacy `newShoreBands`).
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
        drawBands(this._map, this.canvas, rings);
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
