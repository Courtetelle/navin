import type {
  Layer,
  LeafletMouseEvent,
  Map as LeafletMap,
  Point,
  Popup,
} from 'leaflet';

import { escapeHtml } from './escapeHtml.ts';
import type { IsobathLine } from './isobath.ts';
import { estimateDepth, nearDepths } from './isobath.ts';
import { leaflet } from './leaflet.ts';
import { mapBearing } from './mapOrientation.ts';
import { frameCanvas } from './overlayCanvas.ts';

/** Width and colour of a line. */
function lineStyle(depth: number): { color: string; width: number } {
  const major = depth % 10 === 0;
  const middle = depth % 5 === 0;
  if (depth <= 3) return { color: 'rgba(200, 60, 0, 0.85)', width: 1.4 };
  if (major) return { color: 'rgba(0, 60, 140, 0.8)', width: 1.4 };
  if (middle) return { color: 'rgba(0, 90, 170, 0.6)', width: 1 };
  return { color: 'rgba(0, 110, 190, 0.35)', width: 0.7 };
}

function lineStep(zoom: number): number {
  if (zoom >= 15) return 1;
  return zoom >= 13 ? 5 : 10;
}

/**
 * Canvas layer of the depth lines; a tap on the water gives the depth (legacy `newIsobathLayer`).
 * @param lines - Depth lines.
 * @returns The layer.
 */
export function newIsobathLayer(lines: readonly IsobathLine[]): Layer {
  const L = leaflet();
  class IsobathLayer extends L.Layer {
    private canvas: HTMLCanvasElement | null = null;

    override onAdd(map: LeafletMap): this {
      this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide isobaths');
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
      if (this.canvas) drawLines(this._map, this.canvas, lines);
    };

    private readonly onTap = (event: LeafletMouseEvent): void => {
      showDepth(this._map, lines, event);
    };
  }
  return new IsobathLayer();
}

function drawLines(
  map: LeafletMap,
  canvas: HTMLCanvasElement,
  lines: readonly IsobathLine[],
): void {
  const frame = frameCanvas(map, canvas);
  if (!frame) return;
  const { context, side, toCanvas } = frame;
  // Wide enough for the corners of a map turned.
  const bounds = map.getBounds().pad(0.6);
  const zoom = map.getZoom();
  const step = lineStep(zoom);
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  const labels: Array<[Point, number]> = [];
  for (const line of lines) {
    if (line.d === 0 || line.d % step) continue;
    const [lineSouth, lineWest, lineNorth, lineEast] = line.bb;
    if (
      lineNorth < south ||
      lineSouth > north ||
      lineEast < west ||
      lineWest > east
    ) {
      continue;
    }
    const style = lineStyle(line.d);
    context.strokeStyle = style.color;
    context.lineWidth = style.width;
    context.beginPath();
    for (const [index, position] of line.pts.entries()) {
      const point = toCanvas(position);
      if (index) context.lineTo(point.x, point.y);
      else context.moveTo(point.x, point.y);
    }
    context.stroke();
    const labelled = line.d % 5 === 0 || line.d <= 3 || zoom >= 16;
    if (labelled && line.pts.length > 3) {
      const middle = line.pts[Math.floor(line.pts.length / 2)];
      if (!middle) continue;
      const point = toCanvas(middle);
      if (point.x > 0 && point.y > 0 && point.x < side && point.y < side) {
        labels.push([point, line.d]);
      }
    }
  }
  drawLabels(context, labels, mapBearing(map));
}

function drawLabels(
  context: CanvasRenderingContext2D,
  labels: ReadonlyArray<[Point, number]>,
  bearing: number,
): void {
  context.font = '600 11px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const placed: Point[] = [];
  for (const [point, depth] of labels) {
    const crowded = placed.some(
      (other) =>
        Math.abs(other.x - point.x) < 40 && Math.abs(other.y - point.y) < 16,
    );
    if (crowded) continue;
    placed.push(point);
    // Upright on the screen, whichever way the map is turned.
    context.save();
    context.translate(point.x, point.y);
    context.rotate((-bearing * Math.PI) / 180);
    context.lineWidth = 3;
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.strokeText(`${depth} m`, 0, 0);
    context.fillStyle = depth <= 3 ? '#b03000' : '#003c8c';
    context.fillText(`${depth} m`, 0, 0);
    context.restore();
  }
}

function showDepth(
  map: LeafletMap,
  lines: readonly IsobathLine[],
  event: LeafletMouseEvent,
): void {
  if (map.getZoom() < 13) return;
  const { lat, lng } = event.latlng;
  const estimate = estimateDepth(nearDepths(lines, lat, lng));
  if (!estimate) return;
  const { first, second, depth } = estimate;
  const text =
    second && depth !== null
      ? `≈ ${depth.toFixed(1)} m (entre les courbes ${Math.min(first[1], second[1])} m et ${Math.max(first[1], second[1])} m)`
      : `≈ ${first[1]} m (courbe à ${Math.round(first[0])} m)`;
  const line = `<div class="zone-pop isob-pop"><b>Profondeur ${escapeHtml(text)}</b><br><small>Courbes swissBATHY3D calculées sur l’appareil, indicatif, niveau moyen du lac (372 m)</small></div>`;
  // The popup of the shore zones stays: the depth goes under it.
  setTimeout(() => {
    const open = openPopup(map);
    if (open && map.hasLayer(open) && open.getLatLng()?.equals(event.latlng)) {
      const content = open.getContent();
      open.setContent(`${typeof content === 'string' ? content : ''}${line}`);
    } else {
      leaflet()
        .popup({ maxWidth: 300 })
        .setLatLng(event.latlng)
        .setContent(line)
        .openOn(map);
    }
  }, 0);
}

function openPopup(map: LeafletMap): Popup | undefined {
  return (map as unknown as { _popup?: Popup })._popup;
}
