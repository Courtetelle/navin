import { fmtPos } from '../../lib/geo.ts';
import { bft, compassPoint, windTxt } from '../../lib/wind.ts';
import { inInland } from '../../model/contacts.ts';
import { BEAUFORT_TBL } from '../../model/lists.ts';
import { deliver, state } from '../../state/index.ts';

import { onLake } from './onLake.ts';
import type { SeaNow } from './seaNow.ts';
import { seaNow, seaRows } from './seaNow.ts';
import type { WindPoint } from './stationHistory.ts';
import { HISTORY_MS, stationHistory, windTrend } from './stationHistory.ts';
import { chartPaths, trendText } from './trendText.ts';
import {
  SEA_MODEL,
  flashColor,
  flashInk,
  seaMarks,
  seaTxt,
  windAlertConfig,
} from './windLogic.ts';
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
 * Cut a text into lines that fit a width.
 * @param context - Canvas, with its font set.
 * @param text - The text.
 * @param width - Width in pixels.
 * @returns The lines.
 */
function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

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

const font = (size: number, bold = false) =>
  `${bold ? 'bold ' : ''}${size}px -apple-system, Helvetica, Arial, sans-serif`;

/** Height of the trend section of the image. */
const TREND_HEIGHT = 420;

/**
 * Draw the wind of the last hours, as Live météo shows it: one sentence,
 * the mean wind as a line, the gusts as a light band above it.
 * @param context - Canvas of the image.
 * @param points - Points, oldest first.
 * @param top - Top of the section.
 */
function drawTrend(
  context: CanvasRenderingContext2D,
  points: readonly WindPoint[],
  top: number,
): void {
  const paths = chartPaths(points);
  let y = top + 20;
  context.fillStyle = '#0b3d91';
  context.font = font(36, true);
  context.fillText('📈 Tendance du vent', 40, y);
  const titleWidth = context.measureText('📈 Tendance du vent ').width;
  context.font = font(30);
  context.fillText(`(${HISTORY_MS / 3_600_000} h)`, 40 + titleWidth, y);
  y += 46;
  context.fillStyle = '#0b1220';
  context.font = font(30);
  context.fillText(trendText(windTrend(points)), 40, y);
  const box = { x: 120, y: y + 24, width: 920, height: 220 };
  context.fillStyle = '#f2f5f9';
  context.fillRect(box.x, box.y, box.width, box.height);
  const first = points[0]?.t ?? 0;
  const span = Math.max((points.at(-1)?.t ?? first) - first, 60_000);
  const px = (t: number) => box.x + ((t - first) / span) * box.width;
  const py = (knots: number) =>
    box.y + box.height - (knots / paths.top) * box.height;
  const withGust = points.filter((point) => point.gust != null);
  if (withGust.length >= 2) {
    context.beginPath();
    for (const [index, point] of withGust.entries()) {
      const x = px(point.t);
      const yy = py(point.gust ?? point.avg);
      if (index) context.lineTo(x, yy);
      else context.moveTo(x, yy);
    }
    for (const point of withGust.toReversed()) {
      context.lineTo(px(point.t), py(point.avg));
    }
    context.closePath();
    context.fillStyle = 'rgba(255, 140, 0, 0.3)';
    context.fill();
  }
  context.beginPath();
  for (const [index, point] of points.entries()) {
    if (index) context.lineTo(px(point.t), py(point.avg));
    else context.moveTo(px(point.t), py(point.avg));
  }
  context.strokeStyle = '#1677ff';
  context.lineWidth = 5;
  context.lineJoin = 'round';
  context.stroke();
  context.fillStyle = '#5b6575';
  context.font = font(24);
  context.fillText(`${Math.round(paths.top)} nd`, 40, box.y + 22);
  context.fillText('0 nd', 40, box.y + box.height);
  const axis = box.y + box.height + 34;
  context.fillText(paths.since, box.x, axis);
  const now = 'maintenant';
  context.fillText(
    now,
    box.x + box.width - context.measureText(now).width,
    axis,
  );
  const key = axis + 40;
  context.fillStyle = '#1677ff';
  context.fillRect(box.x, key - 12, 40, 6);
  context.fillStyle = '#333c4a';
  context.fillText('vent moyen', box.x + 52, key);
  if (withGust.length >= 2) {
    const at = box.x + 52 + context.measureText('vent moyen').width + 40;
    context.fillStyle = 'rgba(255, 140, 0, 0.45)';
    context.fillRect(at, key - 20, 40, 20);
    context.fillStyle = '#333c4a';
    context.fillText('rafales', at + 52, key);
  }
}

/**
 * The image of an alert: the card of the station, as in Live météo, and a
 * map that places the measurement.
 * @param report - The alert.
 * @param sea - The sea of the model, at sea only.
 * @param trend - The wind of the last hours, when the station has enough past.
 * @returns The PNG.
 */
export async function alertImage(
  report: AlertReport,
  sea: SeaNow | null = null,
  trend: readonly WindPoint[] | null = null,
): Promise<Blob | null> {
  const width = 1080;
  const rows = reportRows(report);
  const seaLines = sea ? seaRows(sea) : [];
  const head = 260;
  const rowHeight = 64;
  const mapHeight = 620;
  const force = bft(report.reading.gust ?? report.reading.avg);
  const marks = sea ? seaMarks(sea.total.height, force) : [];
  const measure = document.createElement('canvas').getContext('2d');
  if (measure) {
    measure.font = '28px -apple-system, Helvetica, Arial, sans-serif';
  }
  const markLines = marks.map(([title, text]): [string, string[]] => [
    title,
    measure ? wrap(measure, text, width - 80) : [text],
  ]);
  const marksHeight = sea
    ? 70 + markLines.reduce((sum, [, lines]) => sum + 44 + lines.length * 38, 0)
    : 0;
  const seaHeight = sea ? 150 + seaLines.length * rowHeight + marksHeight : 0;
  const trendHeight = trend ? TREND_HEIGHT : 0;
  const height =
    head +
    rows.length * rowHeight +
    trendHeight +
    seaHeight +
    40 +
    mapHeight +
    90;
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
  if (trend) {
    drawTrend(context, trend, y);
    y += TREND_HEIGHT;
  }
  if (sea) {
    y += 20;
    context.fillStyle = '#0b3d91';
    context.font = 'bold 36px -apple-system, Helvetica, Arial, sans-serif';
    context.fillText('🌊 État de la mer', 40, y);
    const titleWidth = context.measureText('🌊 État de la mer ').width;
    context.font = '30px -apple-system, Helvetica, Arial, sans-serif';
    context.fillText(`(modèle ${SEA_MODEL})`, 40 + titleWidth, y);
    y += 46;
    context.fillStyle = '#0b1220';
    context.font = '30px -apple-system, Helvetica, Arial, sans-serif';
    context.fillText(
      `${seaTxt({ waveH: sea.total.height })} · prévision du modèle, pas une mesure`,
      40,
      y,
    );
    y += 64;
    for (const [label, value] of seaLines) {
      context.fillStyle = '#5b6575';
      context.font = '30px -apple-system, Helvetica, Arial, sans-serif';
      context.fillText(label, 40, y);
      context.fillStyle = '#0b1220';
      context.font = 'bold 34px -apple-system, Helvetica, Arial, sans-serif';
      context.fillText(value, 440, y);
      y += rowHeight;
    }
    y += 20;
    context.fillStyle = '#0b3d91';
    context.font = 'bold 36px -apple-system, Helvetica, Arial, sans-serif';
    context.fillText('📘 Repères', 40, y);
    y += 50;
    for (const [title, lines] of markLines) {
      context.fillStyle = '#0b1220';
      context.font = 'bold 30px -apple-system, Helvetica, Arial, sans-serif';
      context.fillText(title, 40, y);
      y += 40;
      context.fillStyle = '#333c4a';
      context.font = '28px -apple-system, Helvetica, Arial, sans-serif';
      for (const line of lines) {
        context.fillText(line, 40, y);
        y += 38;
      }
      y += 4;
    }
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
 * The sea near the station, from the model: at sea only, never on a lake,
 * and not waited for more than a few seconds.
 * @param report - The alert.
 * @returns The sea, or null.
 */
async function seaAround(report: AlertReport): Promise<SeaNow | null> {
  const { lat, lon } = report.reading;
  if (onLake() || lat == null || lon == null || inInland({ lat, lon })) {
    return null;
  }
  const late = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 8000);
  });
  return Promise.race([seaNow({ lat, lon }).catch(() => null), late]);
}

/**
 * The wind of the station over the last hours: only for a measuring
 * station, only when enough past is known, and not waited for long.
 * @param report - The alert.
 * @returns The points, oldest first, or null.
 */
async function trendAround(report: AlertReport): Promise<WindPoint[] | null> {
  const { id, net } = report.reading;
  if (report.forecast || !id || !net) return null;
  const { mfKey } = windAlertConfig(state.preferences.settings.value);
  const late = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 8000);
  });
  const points = await Promise.race([
    stationHistory({ id, net }, mfKey, Date.now(), HISTORY_MS).catch(
      () => null,
    ),
    late,
  ]);
  return points && points.length >= 3 ? points : null;
}

/**
 * Publish an alert: its image goes to the share sheet (messages, mail, AirDrop).
 * @param report - The alert.
 */
export async function publishAlert(report: AlertReport): Promise<void> {
  const [sea, trend] = await Promise.all([
    seaAround(report),
    trendAround(report),
  ]);
  const image = await alertImage(report, sea, trend).catch(() => null);
  const stamp = new Date(report.reading.t)
    .toISOString()
    .slice(0, 16)
    .replace(':', 'h');
  if (image) {
    await deliver(image, `alerte-vent-${stamp}.png`, 'image/png');
    return;
  }
  const text = [
    ...reportRows(report),
    ...(trend
      ? [['Tendance du vent', trendText(windTrend(trend))] as [string, string]]
      : []),
    ...(sea ? seaRows(sea) : []),
    ...(sea
      ? seaMarks(
          sea.total.height,
          bft(report.reading.gust ?? report.reading.avg),
        )
      : []),
  ]
    .map(([label, value]) => `${label} : ${value}`)
    .join('\n');
  await deliver(
    `Alerte vent · ${report.reading.name}\n${report.wind}\n${text}`,
    `alerte-vent-${stamp}.txt`,
    'text/plain',
  );
}
