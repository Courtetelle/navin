import type { LatLngPair } from './constants.ts';

/**
 * Swiss LV95 coordinates to WGS84 (legacy `lv95ToWgs`).
 * @param east - East coordinate in metres.
 * @param north - North coordinate in metres.
 * @returns `[lat, lon]`.
 */
export function lv95ToWgs(east: number, north: number): LatLngPair {
  const y = (east - 2_600_000) / 1e6;
  const x = (north - 1_200_000) / 1e6;
  const lon =
    2.677_909_4 +
    4.728_982 * y +
    0.791_484 * y * x +
    0.1306 * y * x * x -
    0.0436 * y * y * y;
  const lat =
    16.902_389_2 +
    3.238_272 * x -
    0.270_978 * y * y -
    0.002_528 * x * x -
    0.0447 * y * y * x -
    0.014 * x * x * x;
  return [(lat * 100) / 36, (lon * 100) / 36];
}

/**
 * Douglas-Peucker simplification of a line in metres (legacy `dpSimplifyXY`).
 * @param points - `[x, y]` points.
 * @param tolerance - Largest distance allowed.
 * @returns The points kept.
 */
export function dpSimplifyXY(
  points: ReadonlyArray<readonly [number, number]>,
  tolerance: number,
): Array<readonly [number, number]> {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  const limit = tolerance * tolerance;
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    const [ax, ay] = points[first] as readonly [number, number];
    const [bx, by] = points[last] as readonly [number, number];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy || 1e-12;
    let worst = 0;
    let worstIndex = -1;
    for (let index = first + 1; index < last; index++) {
      const [px, py] = points[index] as readonly [number, number];
      const ratio = Math.max(
        0,
        Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length),
      );
      const ex = ax + ratio * dx - px;
      const ey = ay + ratio * dy - py;
      const distance = ex * ex + ey * ey;
      if (distance > worst) {
        worst = distance;
        worstIndex = index;
      }
    }
    if (worst > limit) {
      keep[worstIndex] = 1;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }
  const kept: Array<readonly [number, number]> = [];
  for (let index = 0; index < points.length; index++) {
    if (keep[index]) kept.push(points[index] as readonly [number, number]);
  }
  return kept;
}
