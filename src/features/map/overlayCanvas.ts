import type { LatLngExpression, Map as LeafletMap, Point } from 'leaflet';

import { leaflet } from './leaflet.ts';

/** A canvas placed over a map, ready for drawing. */
export interface CanvasFrame {
  context: CanvasRenderingContext2D;
  /** Side of the square drawn, in pixels. */
  side: number;
  /** A position in pixels of the canvas. */
  toCanvas: (position: LatLngExpression) => Point;
}

/**
 * Lay a canvas of an overlay pane over a map: a square as wide as the diagonal
 * of the map, so that it still covers the screen when the map is turned.
 * @param map - Leaflet map.
 * @param canvas - The canvas, in a pane that turns with the map.
 * @returns What to draw with, or `null` without a drawing context.
 */
export function frameCanvas(
  map: LeafletMap,
  canvas: HTMLCanvasElement,
): CanvasFrame | null {
  const size = map.getSize();
  const side = Math.ceil(Math.hypot(size.x, size.y));
  const origin = map
    .latLngToLayerPoint(map.getCenter())
    .subtract([side / 2, side / 2])
    .round();
  const ratio = globalThis.devicePixelRatio || 1;
  leaflet().DomUtil.setPosition(canvas, origin);
  canvas.width = side * ratio;
  canvas.height = side * ratio;
  canvas.style.width = `${side}px`;
  canvas.style.height = `${side}px`;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(ratio, ratio);
  return {
    context,
    side,
    toCanvas: (position) => map.latLngToLayerPoint(position).subtract(origin),
  };
}
