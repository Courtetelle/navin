import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { fmtPos } from '../../lib/geo.ts';
import { bft, compassPoint, windTxt } from '../../lib/wind.ts';
import { inInland } from '../../model/contacts.ts';
import { BEAUFORT_TBL } from '../../model/lists.ts';
import { deliver, state } from '../../state/index.ts';
import type { CardsDocument, CardsSection } from '../publish/index.ts';
import { cardsPng, printImage } from '../publish/index.ts';

import { onLake } from './onLake.ts';
import type { SeaNow } from './seaNow.ts';
import { seaNow, seaRows } from './seaNow.ts';
import type { WindPoint } from './stationHistory.ts';
import { HISTORY_MS, stationHistory, windTrend } from './stationHistory.ts';
import { chartPaths, trendText } from './trendText.ts';
import { SEA_MODEL, seaMarks, seaTxt, windAlertConfig } from './windLogic.ts';
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
  // The credit is the caption of the picture.
  context.restore();
}

const font = (size: number, bold = false) =>
  `${bold ? 'bold ' : ''}${size}px -apple-system, Helvetica, Arial, sans-serif`;

/** Size of the trend chart picture. */
const CHART = { width: 1000, height: 330 };
/** Size of the map picture. */
const MAP = { width: 1000, height: 620 };

/**
 * A canvas of a size, white.
 * @param size - Width and height.
 * @returns The canvas and its context, null when the device has none.
 */
function blankCanvas(size: { width: number; height: number }): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} | null {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size.width, size.height);
  return { canvas, context };
}

/**
 * The wind of the last hours as a picture, as Live météo draws it: the mean
 * wind as a line, the gusts as a light band above it, a scale and a key.
 * @param points - Points, oldest first.
 * @returns A data URL, null without a canvas.
 */
export function trendPicture(points: readonly WindPoint[]): string | null {
  const blank = blankCanvas(CHART);
  if (!blank) return null;
  const { canvas, context } = blank;
  const paths = chartPaths(points);
  const box = { x: 90, y: 16, width: CHART.width - 110, height: 220 };
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
      const y = py(point.gust ?? point.avg);
      if (index) context.lineTo(x, y);
      else context.moveTo(x, y);
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
  context.fillText(`${Math.round(paths.top)} nd`, 10, box.y + 22);
  context.fillText('0 nd', 10, box.y + box.height);
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
  return canvas.toDataURL('image/png');
}

/**
 * The map around the station as a picture: the station in red, the boat in
 * blue, on OpenStreetMap.
 * @param report - The alert.
 * @returns A data URL, null without a place or a canvas.
 */
async function mapPicture(report: AlertReport): Promise<string | null> {
  if (report.reading.lat == null || report.reading.lon == null) return null;
  const blank = blankCanvas(MAP);
  if (!blank) return null;
  await drawSnippet(blank.context, report, { x: 0, y: 0, ...MAP });
  try {
    return blank.canvas.toDataURL('image/png');
  } catch {
    // A tile without its permission spoils the canvas: no map then.
    return null;
  }
}

/**
 * The alert as a document of the layout chosen in Réglages: the card of the
 * station, the trend, the sea and its marks, then the map.
 * @param report - The alert.
 * @param sea - The sea of the model, at sea only.
 * @param trend - The wind of the last hours, when the station has enough past.
 * @returns The document.
 */
export async function alertDocument(
  report: AlertReport,
  sea: SeaNow | null = null,
  trend: readonly WindPoint[] | null = null,
): Promise<CardsDocument> {
  const { reading, wind, forecast } = report;
  const sections: CardsSection[] = [
    { title: forecast ? 'Prévision' : 'Station', rows: reportRows(report) },
  ];
  if (trend) {
    const chart = trendPicture(trend);
    sections.push({
      title: `Tendance du vent (${HISTORY_MS / 3_600_000} h)`,
      rows: [
        [
          'Tendance',
          trendText(windTrend(trend)),
          chart ? [{ url: chart }] : [],
        ],
      ],
    });
  }
  if (sea) {
    const force = bft(reading.gust ?? reading.avg);
    sections.push(
      {
        title: `État de la mer (modèle ${SEA_MODEL})`,
        rows: [
          [
            'Mer',
            `${seaTxt({ waveH: sea.total.height })} · prévision du modèle, pas une mesure`,
          ],
          ...seaRows(sea),
        ],
      },
      { title: 'Repères', rows: seaMarks(sea.total.height, force) },
    );
  }
  const map = await mapPicture(report);
  return {
    title: `Alerte vent · ${reading.name}`,
    kicker: 'Live météo',
    sub: `${wind} · ${forecast ? 'PRÉVISION, pas une mesure' : 'mesure'}`,
    sections,
    photos: map ? [{ url: map, cap: '© OpenStreetMap France' }] : [],
    photosTitle: 'Carte',
  };
}

/**
 * The image of an alert, in the layout chosen in Réglages.
 * @param report - The alert.
 * @param sea - The sea of the model, at sea only.
 * @param trend - The wind of the last hours, when the station has enough past.
 * @returns The PNG.
 */
export async function alertImage(
  report: AlertReport,
  sea: SeaNow | null = null,
  trend: readonly WindPoint[] | null = null,
): Promise<Blob> {
  return cardsPng(await alertDocument(report, sea, trend));
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
 * Share an alert: its image goes to the share sheet (WhatsApp, Messages…),
 * or the same image as a PDF (mail, print).
 * @param report - The alert.
 * @param format - Image or PDF.
 */
export async function publishAlert(
  report: AlertReport,
  format: ShareFormat = 'image',
): Promise<void> {
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
    if (format === 'pdf') await printImage(image, `alerte-vent-${stamp}`);
    else await deliver(image, `alerte-vent-${stamp}.png`, 'image/png');
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
