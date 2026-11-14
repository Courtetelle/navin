import { rad } from '../../lib/geo.ts';

const TILE = 256;
const WIDTH = 1000;
const HEIGHT = 640;
const MARGIN = 80;

/** A point of a plan. */
interface PlanPoint {
  lat: number;
  lon: number;
}

/** What a plan shows. */
export interface PlanContent {
  /** Lines drawn in red (a track), each a list of points. */
  lines?: ReadonlyArray<readonly PlanPoint[]>;
  /** Pins: a mark, the start and the end of a track. */
  pins?: ReadonlyArray<PlanPoint & { color: string; label?: string }>;
  /**
   * The closest zoom: a single point shows its surroundings.
   * @default 13
   */
  maxZoom?: number;
}

function projectX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE * 2 ** zoom;
}

function projectY(lat: number, zoom: number): number {
  const radians = rad(lat);
  const mercator = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
  return ((1 - mercator / Math.PI) / 2) * TILE * 2 ** zoom;
}

function loadTile(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => resolve(null));
    image.src = source;
  });
}

async function drawTile(
  context: CanvasRenderingContext2D,
  zoom: number,
  [column, row]: [number, number],
  [x, y]: [number, number],
): Promise<boolean> {
  const base = await loadTile(
    `https://${'abc'[(column + row) % 3]}.tile.openstreetmap.fr/osmfr/${zoom}/${column}/${row}.png`,
  );
  if (!base) return false;
  context.drawImage(base, x, y);
  const marks = await loadTile(
    `https://tiles.openseamap.org/seamark/${zoom}/${column}/${row}.png`,
  );
  if (marks) context.drawImage(marks, x, y);
  return true;
}

async function drawTiles(
  context: CanvasRenderingContext2D,
  zoom: number,
  left: number,
  top: number,
): Promise<number> {
  const jobs: Array<Promise<boolean>> = [];
  const lastColumn = Math.floor((left + WIDTH) / TILE);
  const lastRow = Math.floor((top + HEIGHT) / TILE);
  for (let column = Math.floor(left / TILE); column <= lastColumn; column++) {
    for (let row = Math.floor(top / TILE); row <= lastRow; row++) {
      jobs.push(
        drawTile(
          context,
          zoom,
          [column, row],
          [column * TILE - left, row * TILE - top],
        ),
      );
    }
  }
  const drawn = await Promise.all(jobs);
  return drawn.filter(Boolean).length;
}

/**
 * A plan of the situation, for a share: the OpenStreetMap background (with
 * the sea marks) when the network allows it, the track and the pins on it.
 * @param content - Lines and pins.
 * @returns PNG data URL, null with nothing to show.
 */
export async function planImage(content: PlanContent): Promise<string | null> {
  const points = [...(content.lines ?? []).flat(), ...(content.pins ?? [])];
  if (points.length === 0) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const { lat, lon } of points) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }
  let zoom = content.maxZoom ?? 13;
  while (
    zoom > 3 &&
    (projectX(east, zoom) - projectX(west, zoom) > WIDTH - 2 * MARGIN ||
      projectY(south, zoom) - projectY(north, zoom) > HEIGHT - 2 * MARGIN)
  ) {
    zoom--;
  }
  const left = (projectX(west, zoom) + projectX(east, zoom)) / 2 - WIDTH / 2;
  const top = (projectY(south, zoom) + projectY(north, zoom)) / 2 - HEIGHT / 2;
  const at = ({ lat, lon }: PlanPoint): [number, number] => [
    projectX(lon, zoom) - left,
    projectY(lat, zoom) - top,
  ];
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = '#cfe3f3';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const tiles = navigator.onLine
    ? await drawTiles(context, zoom, left, top)
    : 0;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  for (const [width, color] of [
    [11, '#fff'],
    [6, '#d00000'],
  ] as const) {
    context.lineWidth = width;
    context.strokeStyle = color;
    for (const line of content.lines ?? []) {
      context.beginPath();
      for (const [index, point] of line.entries()) {
        const [x, y] = at(point);
        if (index) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      context.stroke();
    }
  }
  context.font =
    '800 26px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  for (const pin of content.pins ?? []) {
    const [x, y] = at(pin);
    context.beginPath();
    context.arc(x, y, 15, 0, 2 * Math.PI);
    context.fillStyle = pin.color;
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = '#fff';
    context.stroke();
    if (pin.label) {
      const width = context.measureText(pin.label).width;
      context.fillStyle = 'rgba(255,255,255,.9)';
      context.fillRect(x + 22, y - 20, width + 16, 38);
      context.fillStyle = '#000';
      context.fillText(pin.label, x + 30, y + 9);
    }
  }
  if (tiles > 0) {
    context.font = '500 16px Arial, sans-serif';
    const credit = '© OpenStreetMap · OpenSeaMap';
    const width = context.measureText(credit).width;
    context.fillStyle = 'rgba(255,255,255,.85)';
    context.fillRect(WIDTH - width - 18, HEIGHT - 26, width + 14, 22);
    context.fillStyle = '#333';
    context.fillText(credit, WIDTH - width - 11, HEIGHT - 10);
  }
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
