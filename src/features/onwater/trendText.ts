import type { WindPoint, WindTrend } from './stationHistory.ts';

const WIDTH = 300;
const HEIGHT = 80;

/** Paths of the trend chart. */
interface ChartPaths {
  width: number;
  height: number;
  /** Mean wind, a line. */
  avg: string;
  /** Band from the mean wind up to the gusts, empty without gusts. */
  gust: string;
  /** Wind at the top of the chart, in knots. */
  top: number;
  /** Left end of the time axis, in words. */
  since: string;
}

/**
 * The trend in one sentence.
 * @param trend - Where the wind goes, null without enough past.
 * @returns `↗ En hausse : +6 nd en 1 h`…
 */
export function trendText(trend: WindTrend | null): string {
  if (!trend) return 'Tendance : pas encore assez de recul';
  const span = duration(trend.minutes);
  const change = Math.round(Math.abs(trend.change));
  if (trend.way === 'up') return `↗ En hausse : +${change} nd en ${span}`;
  if (trend.way === 'down') return `↘ En baisse : −${change} nd en ${span}`;
  return `→ Stable depuis ${span}`;
}

/**
 * The chart, from the first point to now: the mean wind and the gusts,
 * from 0 to a round top.
 * @param points - Points, oldest first.
 * @returns The paths.
 */
export function chartPaths(points: readonly WindPoint[]): ChartPaths {
  const first = points[0]?.t ?? 0;
  const last = points.at(-1)?.t ?? first;
  const span = Math.max(last - first, 60_000);
  const high = Math.max(
    ...points.map((point) => Math.max(point.avg, point.gust ?? 0)),
  );
  const top = Math.max(10, Math.ceil(high / 5) * 5);
  const x = (t: number) => (((t - first) / span) * WIDTH).toFixed(1);
  const y = (knots: number) => (HEIGHT - (knots / top) * HEIGHT).toFixed(1);
  // A gap of the record (NavIn closed): the line stops and starts again.
  const runs = splitAtGaps(points);
  const avg = runs
    .map((run) =>
      run.length === 1 && run[0]
        ? `M${x(run[0].t)} ${y(run[0].avg)}l0.1 0`
        : run
            .map(
              (point, index) =>
                `${index ? 'L' : 'M'}${x(point.t)} ${y(point.avg)}`,
            )
            .join(''),
    )
    .join('');
  const gust = runs
    .map((run) => {
      const withGust = run.filter((point) => point.gust != null);
      if (withGust.length < 2) return '';
      return `${withGust
        .map(
          (point, index) =>
            `${index ? 'L' : 'M'}${x(point.t)} ${y(point.gust ?? point.avg)}`,
        )
        .join('')}${withGust
        .toReversed()
        .map((point) => `L${x(point.t)} ${y(point.avg)}`)
        .join('')}Z`;
    })
    .join('');
  const minutes = Math.round(span / 60_000);
  const since =
    minutes >= 90
      ? `il y a ${Math.round(span / 3_600_000)} h`
      : `il y a ${minutes} min`;
  return { width: WIDTH, height: HEIGHT, avg, gust, top, since };
}

/** Longer than this without a measurement, the curve is cut. */
const GAP_MS = 45 * 60_000;

/**
 * The points in runs without a gap of the record.
 * @param points - Points, oldest first.
 * @returns The runs.
 */
function splitAtGaps(points: readonly WindPoint[]): WindPoint[][] {
  const runs: WindPoint[][] = [];
  let run: WindPoint[] = [];
  for (const point of points) {
    const last = run.at(-1);
    if (last && point.t - last.t > GAP_MS) {
      runs.push(run);
      run = [];
    }
    run.push(point);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`;
}
