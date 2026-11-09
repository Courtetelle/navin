import { fmtDur, fr } from '../../lib/format.ts';
import { rad } from '../../lib/geo.ts';
import { navForDay } from '../../state/index.ts';

import { entryColor, mapData, segments } from './externals.ts';

const TILE = 256;
const WIDTH = 1000;
const HEIGHT = 700;
const MARGIN = 70;
const FONT = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const cache = new Map<string, string>();

/**
 * Image of the track of a day: OpenStreetMap background when the network
 * allows it, else the track alone (legacy `traceImage`).
 * @param key - Day key.
 * @returns PNG data URL, null without track.
 */
export async function traceImage(key: string): Promise<string | null> {
  const { line, ents: entries, nm } = mapData(key);
  const first = line[0];
  const last = line.at(-1);
  if (line.length < 2 || !first || !last) return null;
  const cacheKey = `${key}:${line.length}:${entries.length}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const view = fitView(line);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = '#cfe3f3';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const tiles = await drawTiles(context, view);
  const point = (lat: number, lon: number) => view.project(lat, lon);
  const drawPath = (width: number, color: string) => {
    context.lineWidth = width;
    context.strokeStyle = color;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    for (const segment of segments(line)) {
      context.beginPath();
      for (const [index, [lat, lon]] of segment.entries()) {
        const [x, y] = point(lat, lon);
        if (index) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      context.stroke();
    }
  };
  drawPath(11, '#fff');
  drawPath(6, '#d00000');
  const drawDot = (lat: number, lon: number, radius: number, fill: string) => {
    const [x, y] = point(lat, lon);
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = '#000';
    context.stroke();
  };
  for (const entry of entries) {
    drawDot(entry.v.pos.lat, entry.v.pos.lon, 9, entryColor(entry));
  }
  drawDot(first.lat, first.lon, 14, '#00a040');
  drawDot(last.lat, last.lon, 14, '#d00000');
  const navigated = navForDay(key).ms || last.t - first.t;
  drawLegend(context, `${fr(nm)} NM · ${fmtDur(navigated)}`, tiles > 0);
  try {
    const url = canvas.toDataURL('image/png');
    cache.set(cacheKey, url);
    return url;
  } catch {
    return null;
  }
}

function projectX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE * 2 ** zoom;
}

function projectY(lat: number, zoom: number): number {
  const radians = rad(lat);
  const mercator = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
  return ((1 - mercator / Math.PI) / 2) * TILE * 2 ** zoom;
}

interface TraceView {
  zoom: number;
  left: number;
  top: number;
  project: (lat: number, lon: number) => [number, number];
}

function fitView(line: ReadonlyArray<{ lat: number; lon: number }>): TraceView {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const { lat, lon } of line) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }
  let zoom = 17;
  while (
    zoom > 3 &&
    (projectX(east, zoom) - projectX(west, zoom) > WIDTH - 2 * MARGIN ||
      projectY(south, zoom) - projectY(north, zoom) > HEIGHT - 2 * MARGIN)
  ) {
    zoom--;
  }
  const left = (projectX(west, zoom) + projectX(east, zoom)) / 2 - WIDTH / 2;
  const top = (projectY(south, zoom) + projectY(north, zoom)) / 2 - HEIGHT / 2;
  return {
    zoom,
    left,
    top,
    project: (lat, lon) => [
      projectX(lon, zoom) - left,
      projectY(lat, zoom) - top,
    ],
  };
}

function loadTile(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 6000);
    image.addEventListener('load', () => {
      clearTimeout(timer);
      resolve(image);
    });
    image.addEventListener('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    image.src = source;
  });
}

// A tile that does not load (no network) is simply left empty.
async function drawTiles(
  context: CanvasRenderingContext2D,
  { zoom, left, top }: TraceView,
): Promise<number> {
  if (!navigator.onLine) return 0;
  const jobs: Array<Promise<boolean>> = [];
  const lastColumn = Math.floor((left + WIDTH) / TILE);
  const lastRow = Math.floor((top + HEIGHT) / TILE);
  for (let column = Math.floor(left / TILE); column <= lastColumn; column++) {
    for (let row = Math.floor(top / TILE); row <= lastRow; row++) {
      jobs.push(drawTile(context, zoom, column, row, left, top));
    }
  }
  const drawn = await Promise.all(jobs);
  return drawn.filter(Boolean).length;
}

async function drawTile(
  context: CanvasRenderingContext2D,
  zoom: number,
  column: number,
  row: number,
  left: number,
  top: number,
): Promise<boolean> {
  const image = await loadTile(
    `https://${'abc'[(column + row) % 3]}.tile.openstreetmap.fr/osmfr/${zoom}/${column}/${row}.png`,
  );
  if (!image) return false;
  context.drawImage(image, column * TILE - left, row * TILE - top);
  return true;
}

function drawLegend(
  context: CanvasRenderingContext2D,
  title: string,
  withAttribution: boolean,
): void {
  context.font = `800 34px ${FONT}`;
  const titleWidth = context.measureText(title).width;
  context.fillStyle = 'rgba(255,255,255,.92)';
  context.fillRect(16, 16, titleWidth + 32, 56);
  context.fillStyle = '#000';
  context.fillText(title, 32, 57);
  context.font = `600 20px ${FONT}`;
  const legend = '● départ   ● arrivée';
  context.fillStyle = 'rgba(255,255,255,.92)';
  context.fillRect(16, HEIGHT - 50, context.measureText(legend).width + 28, 36);
  const baseline = HEIGHT - 25;
  context.fillStyle = '#00a040';
  context.fillText('●', 30, baseline);
  context.fillStyle = '#000';
  context.fillText(' départ', 46, baseline);
  const second = 46 + context.measureText(' départ   ').width;
  context.fillStyle = '#d00000';
  context.fillText('●', second, baseline);
  context.fillStyle = '#000';
  context.fillText(' arrivée', second + 16, baseline);
  if (!withAttribution) return;
  context.font = '500 16px Arial, sans-serif';
  const attribution = '© OpenStreetMap France';
  const width = context.measureText(attribution).width;
  context.fillStyle = 'rgba(255,255,255,.85)';
  context.fillRect(WIDTH - width - 18, HEIGHT - 26, width + 14, 22);
  context.fillStyle = '#333';
  context.fillText(attribution, WIDTH - width - 11, HEIGHT - 10);
}
