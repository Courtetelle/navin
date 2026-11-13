import { fmtPos } from '../../lib/geo.ts';
import { bft, compassPoint, windTxt } from '../../lib/wind.ts';
import { BEAUFORT_TBL } from '../../model/lists.ts';
import { deliver } from '../../state/index.ts';

import { flashColor, flashInk } from './windLogic.ts';
import type { WindReading } from './windTypes.ts';

/** What an alert publishes: the reading, as Live météo shows it, and where. */
export interface AlertReport {
  /** The reading that raised the alert. */
  reading: WindReading;
  /** Wind of the alert, e.g. `20 nd en rafales`. */
  wind: string;
  /** A forecast of a model, not a measurement. */
  forecast: boolean;
  /** The boat when the alert was given. */
  boat: { lat: number; lon: number } | null;
}

const fr = (value: number, digits = 1) =>
  value.toFixed(digits).replace('.', ',');

/**
 * The lines of the report, as the station card of Live météo reads them.
 * @param report - The alert.
 * @returns `[label, value]` pairs.
 */
export function reportRows(report: AlertReport): Array<[string, string]> {
  const { reading, forecast } = report;
  const force = bft(reading.avg);
  const rows: Array<[string, string]> = [
    ['Vent moyen', windTxt(reading.avg)],
    ['Rafales', reading.gust == null ? '—' : windTxt(reading.gust)],
    [
      'Direction',
      reading.dir == null
        ? '—'
        : `du ${compassPoint(reading.dir)} (${Math.round(reading.dir)}°)`,
    ],
    ['Force', `${force} Bf · ${BEAUFORT_TBL[Math.min(12, force)]?.[2] ?? ''}`],
  ];
  if (reading.air != null) {
    rows.push(['Température de l’air', `${fr(reading.air)} °C`]);
  }
  if (reading.baro != null) {
    rows.push([
      'Pression (niveau de la mer)',
      `${Math.round(reading.baro)} hPa`,
    ]);
  }
  const time = new Date(reading.t).toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  rows.push(
    [forecast ? 'Prévu pour' : 'Mesuré', time],
    [
      'Source',
      forecast
        ? 'prévision d’un modèle, pas une mesure'
        : (reading.net ?? 'MeteoSwiss'),
    ],
    ['Distance', reading.km == null ? '—' : `${Math.round(reading.km)} km`],
  );
  if (reading.lat != null && reading.lon != null) {
    rows.push(['Position', fmtPos({ lat: reading.lat, lon: reading.lon })]);
  }
  return rows;
}

const TILE = 256;

/**
 * Pixel of a place on the world at a zoom (Web Mercator).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param zoom - Zoom.
 * @returns x and y in pixels.
 */
export function worldPixel(
  lat: number,
  lon: number,
  zoom: number,
): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size,
  };
}

/**
 * The closest zoom that shows the station and the boat in the map snippet.
 * @param station - The station.
 * @param boat - The boat, if known.
 * @param width - Snippet width in pixels.
 * @param height - Snippet height in pixels.
 * @returns A zoom from 8 to 12.
 */
export function snippetZoom(
  station: { lat: number; lon: number },
  boat: { lat: number; lon: number } | null,
  width: number,
  height: number,
): number {
  for (let zoom = 12; zoom > 8; zoom--) {
    if (!boat) return zoom;
    const a = worldPixel(station.lat, station.lon, zoom);
    const b = worldPixel(boat.lat, boat.lon, zoom);
    if (
      Math.abs(a.x - b.x) < width / 2 - 40 &&
      Math.abs(a.y - b.y) < height / 2 - 40
    ) {
      return zoom;
    }
  }
  return 8;
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
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
    image.src = url;
  });
}

/**
 * Draw the map around the station: OpenStreetMap tiles, the station in red,
 * the boat in blue. Without network, a plain frame says so.
 */
async function drawSnippet(
  context: CanvasRenderingContext2D,
  report: AlertReport,
  box: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const { reading, boat } = report;
  context.fillStyle = '#dfe7ee';
  context.fillRect(box.x, box.y, box.width, box.height);
  if (reading.lat == null || reading.lon == null) return;
  const station = { lat: reading.lat, lon: reading.lon };
  const zoom = snippetZoom(station, boat, box.width, box.height);
  const center = worldPixel(station.lat, station.lon, zoom);
  const left = center.x - box.width / 2;
  const top = center.y - box.height / 2;
  // Everything of the map stays in its frame.
  context.save();
  context.beginPath();
  context.rect(box.x, box.y, box.width, box.height);
  context.clip();
  const jobs: Array<Promise<void>> = [];
  for (
    let tx = Math.floor(left / TILE);
    tx <= Math.floor((left + box.width) / TILE);
    tx++
  ) {
    for (
      let ty = Math.floor(top / TILE);
      ty <= Math.floor((top + box.height) / TILE);
      ty++
    ) {
      const server = 'abc'[(tx + ty) % 3] ?? 'a';
      jobs.push(
        loadTile(
          `https://${server}.tile.openstreetmap.fr/osmfr/${zoom}/${tx}/${ty}.png`,
        ).then((image) => {
          if (image) {
            context.drawImage(
              image,
              box.x + tx * TILE - left,
              box.y + ty * TILE - top,
            );
          }
        }),
      );
    }
  }
  await Promise.all(jobs);
  const dot = (x: number, y: number, color: string, label: string) => {
    context.beginPath();
    context.arc(x, y, 16, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = '#fff';
    context.stroke();
    context.font = 'bold 30px -apple-system, Helvetica, Arial, sans-serif';
    context.lineWidth = 8;
    context.strokeText(label, x + 26, y + 10);
    context.fillStyle = '#111';
    context.fillText(label, x + 26, y + 10);
  };
  if (boat) {
    const at = worldPixel(boat.lat, boat.lon, zoom);
    dot(box.x + at.x - left, box.y + at.y - top, '#1677ff', 'Bateau');
  }
  dot(box.x + box.width / 2, box.y + box.height / 2, '#d0021b', reading.name);
  context.restore();
  context.font = '22px -apple-system, Helvetica, Arial, sans-serif';
  context.fillStyle = '#333';
  context.fillText(
    '© OpenStreetMap France',
    box.x + 12,
    box.y + box.height - 12,
  );
}

/**
 * The image of an alert: the card of the station, as in Live météo, and a
 * map that places the measurement.
 * @param report - The alert.
 * @returns The PNG.
 */
export async function alertImage(report: AlertReport): Promise<Blob | null> {
  const width = 1080;
  const rows = reportRows(report);
  const head = 260;
  const rowHeight = 64;
  const mapHeight = 620;
  const height = head + rows.length * rowHeight + 40 + mapHeight + 90;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const { reading, wind, forecast } = report;
  const level = Math.max(0, bft(reading.gust ?? reading.avg) - 4);
  const color = flashColor(level);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = color;
  context.fillRect(0, 0, width, head);
  context.fillStyle = flashInk(color);
  context.font = 'bold 44px -apple-system, Helvetica, Arial, sans-serif';
  context.fillText(`💨 Alerte vent · ${reading.name}`, 40, 76);
  context.font = 'bold 72px -apple-system, Helvetica, Arial, sans-serif';
  context.fillText(wind, 40, 170);
  context.font = '32px -apple-system, Helvetica, Arial, sans-serif';
  context.fillText(
    forecast ? 'PRÉVISION, pas une mesure' : 'Mesure Live météo',
    40,
    225,
  );
  let y = head + 52;
  for (const [label, value] of rows) {
    context.fillStyle = '#5b6575';
    context.font = '30px -apple-system, Helvetica, Arial, sans-serif';
    context.fillText(label, 40, y);
    context.fillStyle = '#0b1220';
    context.font = 'bold 34px -apple-system, Helvetica, Arial, sans-serif';
    context.fillText(value, 440, y);
    y += rowHeight;
  }
  await drawSnippet(context, report, {
    x: 40,
    y,
    width: width - 80,
    height: mapHeight,
  });
  context.fillStyle = '#5b6575';
  context.font = '26px -apple-system, Helvetica, Arial, sans-serif';
  context.fillText(
    `NavIn · ${new Date().toLocaleString('fr-CH')}`,
    40,
    y + mapHeight + 56,
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Publish an alert: its image goes to the share sheet (messages, mail, AirDrop).
 * @param report - The alert.
 */
export async function publishAlert(report: AlertReport): Promise<void> {
  const image = await alertImage(report).catch(() => null);
  const stamp = new Date(report.reading.t)
    .toISOString()
    .slice(0, 16)
    .replace(':', 'h');
  if (image) {
    await deliver(image, `alerte-vent-${stamp}.png`, 'image/png');
    return;
  }
  const text = reportRows(report)
    .map(([label, value]) => `${label} : ${value}`)
    .join('\n');
  await deliver(
    `Alerte vent · ${report.reading.name}\n${report.wind}\n${text}`,
    `alerte-vent-${stamp}.txt`,
    'text/plain',
  );
}
