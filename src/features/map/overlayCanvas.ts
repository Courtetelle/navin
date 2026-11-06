import type {
  LatLng,
  LatLngExpression,
  Map as LeafletMap,
  Point,
} from 'leaflet';

import { leaflet } from './leaflet.ts';

/** A canvas placed over a map, ready for drawing. */
export interface CanvasFrame {
  context: CanvasRenderingContext2D;
  /** Side of the square drawn, in pixels. */
  side: number;
  /** A position in pixels of the canvas. */
  toCanvas: (position: LatLngExpression) => Point;
}

/** Spare pixels around the map, so that a slow boat does not redraw it all. */
const MARGIN_PX = 96;

/** What a canvas was drawn for. */
interface Drawn {
  zoom: number;
  width: number;
  height: number;
  anchor: LatLng;
  anchorPoint: Point;
}

const drawnFor = new WeakMap<HTMLCanvasElement, Drawn>();

/**
 * Whether a canvas must be drawn again: not while the map only moved a little.
 * @param map - Leaflet map.
 * @param canvas - The canvas.
 * @returns The drawing no longer fits the map.
 */
export function canvasOutdated(
  map: LeafletMap,
  canvas: HTMLCanvasElement,
): boolean {
  const drawn = drawnFor.get(canvas);
  if (!drawn) return true;
  const size = map.getSize();
  if (
    drawn.zoom !== map.getZoom() ||
    drawn.width !== size.x ||
    drawn.height !== size.y
  ) {
    return true;
  }
  const point = map.latLngToLayerPoint(drawn.anchor);
  if (point.distanceTo(drawn.anchorPoint) > 0.5) return true;
  const center = map.latLngToLayerPoint(map.getCenter());
  return center.distanceTo(point) > MARGIN_PX / 2;
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
  const side = Math.ceil(Math.hypot(size.x, size.y)) + MARGIN_PX;
  const anchor = map.getCenter();
  const anchorPoint = map.latLngToLayerPoint(anchor);
  const origin = anchorPoint.subtract([side / 2, side / 2]).round();
  const ratio = globalThis.devicePixelRatio || 1;
  leaflet().DomUtil.setPosition(canvas, origin);
  canvas.width = side * ratio;
  canvas.height = side * ratio;
  canvas.style.width = `${side}px`;
  canvas.style.height = `${side}px`;
  drawnFor.set(canvas, {
    zoom: map.getZoom(),
    width: size.x,
    height: size.y,
    anchor,
    anchorPoint,
  });
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(ratio, ratio);
  return {
    context,
    side,
    toCanvas: (position) => map.latLngToLayerPoint(position).subtract(origin),
  };
}
