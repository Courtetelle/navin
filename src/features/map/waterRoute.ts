/**
 * A route that stays in the water: a grid of cells (1 = water a boat may
 * cross, 0 = land, too close to the shore, or a zone to avoid), the shortest
 * path between two cells, then the fewest straight legs along it.
 * Pure: the grid is filled elsewhere (from the map file of the device).
 */

/** A grid of cells laid on the map, in Web Mercator. */
export interface WaterGrid {
  /** Cells across. */
  w: number;
  /** Cells down. */
  h: number;
  /** 1 where the boat may go, row after row from the north-west. */
  water: Uint8Array;
  /** World pixel (Web Mercator, at {@link WaterGrid.zoom}) of the north-west corner. */
  x0: number;
  y0: number;
  /** Zoom whose pixels are the cells. */
  zoom: number;
}

/** A cell: column, row. */
export type Cell = readonly [number, number];

const TILE = 256;

/**
 * World pixel of a position at a zoom (Web Mercator, 256 px tiles).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param zoom - Zoom.
 * @returns `[x, y]`.
 */
export function worldPixel(
  lat: number,
  lon: number,
  zoom: number,
): [number, number] {
  const scale = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return [
    ((lon + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

/**
 * Position of a world pixel.
 * @param x - World pixel x.
 * @param y - World pixel y.
 * @param zoom - Zoom.
 * @returns Latitude and longitude.
 */
export function pixelPosition(
  x: number,
  y: number,
  zoom: number,
): { lat: number; lon: number } {
  const scale = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lon: (x / scale) * 360 - 180,
  };
}

/**
 * The cell of a position.
 * @param grid - The grid.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The cell, maybe outside the grid.
 */
export function cellOf(grid: WaterGrid, lat: number, lon: number): Cell {
  const [x, y] = worldPixel(lat, lon, grid.zoom);
  return [Math.floor(x - grid.x0), Math.floor(y - grid.y0)];
}

/**
 * The position of the middle of a cell.
 * @param grid - The grid.
 * @param cell - The cell.
 * @returns Latitude and longitude.
 */
export function cellPosition(
  grid: WaterGrid,
  cell: Cell,
): { lat: number; lon: number } {
  return pixelPosition(
    grid.x0 + cell[0] + 0.5,
    grid.y0 + cell[1] + 0.5,
    grid.zoom,
  );
}

/**
 * Metres across one cell at a latitude.
 * @param zoom - Zoom of the grid.
 * @param lat - Latitude.
 * @returns Metres.
 */
export function cellMetres(zoom: number, lat: number): number {
  return (
    (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (TILE * 2 ** zoom)
  );
}

function inside(grid: WaterGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.w && y < grid.h;
}

/**
 * Whether the boat may be in a cell.
 * @param grid - The grid.
 * @param cell - The cell.
 * @returns Water, inside the grid.
 */
export function isWater(grid: WaterGrid, cell: Cell): boolean {
  const [x, y] = cell;
  return inside(grid, x, y) && grid.water[y * grid.w + x] === 1;
}

/**
 * Keep the boat off the shore: every water cell nearer the land than the
 * margin becomes land (a distance in cells, measured in steps of 1 and √2).
 * @param grid - The grid.
 * @param cells - The margin, in cells.
 * @returns A new grid.
 */
export function keepOffShore(grid: WaterGrid, cells: number): WaterGrid {
  if (cells <= 0) return grid;
  const { w, h } = grid;
  const far = new Float32Array(w * h);
  const big = w + h;
  for (let index = 0; index < far.length; index++) {
    far[index] = grid.water[index] === 1 ? big : 0;
  }
  const diagonal = Math.SQRT2;
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? big : (far[y * w + x] as number);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const index = y * w + x;
      far[index] = Math.min(
        far[index] as number,
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + diagonal,
        at(x + 1, y - 1) + diagonal,
      );
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const index = y * w + x;
      far[index] = Math.min(
        far[index] as number,
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + diagonal,
        at(x - 1, y + 1) + diagonal,
      );
    }
  }
  const water = new Uint8Array(w * h);
  for (let index = 0; index < water.length; index++) {
    water[index] = (far[index] as number) > cells ? 1 : 0;
  }
  return { ...grid, water };
}

/**
 * Take out a round zone (a zone to avoid).
 * @param grid - The grid, changed in place.
 * @param lat - Middle.
 * @param lon - Middle.
 * @param metres - Radius.
 */
export function blockCircle(
  grid: WaterGrid,
  lat: number,
  lon: number,
  metres: number,
): void {
  const [cx, cy] = cellOf(grid, lat, lon);
  const radius = metres / cellMetres(grid.zoom, lat);
  const reach = Math.ceil(radius);
  for (let y = cy - reach; y <= cy + reach; y++) {
    for (let x = cx - reach; x <= cx + reach; x++) {
      if (inside(grid, x, y) && Math.hypot(x - cx, y - cy) <= radius) {
        grid.water[y * grid.w + x] = 0;
      }
    }
  }
}

/**
 * The nearest water cell, for a point laid in a port or on the shore.
 * @param grid - The grid.
 * @param cell - The cell.
 * @param reach - Farthest search, in cells.
 * @returns The cell, or `null` when no water is that near.
 */
export function nearestWater(
  grid: WaterGrid,
  cell: Cell,
  reach: number,
): Cell | null {
  if (isWater(grid, cell)) return cell;
  for (let ring = 1; ring <= reach; ring++) {
    let best: Cell | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const next: Cell = [cell[0] + dx, cell[1] + dy];
        const gap = Math.hypot(dx, dy);
        if (gap < bestGap && isWater(grid, next)) {
          best = next;
          bestGap = gap;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** A small binary heap of cell indexes by cost. */
class Heap {
  private readonly items: number[] = [];
  private readonly costs: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, cost: number): void {
    this.items.push(item);
    this.costs.push(cost);
    let at = this.items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if ((this.costs[parent] as number) <= cost) break;
      this.swap(at, parent);
      at = parent;
    }
  }

  pop(): number {
    const top = this.items[0] as number;
    const lastItem = this.items.pop() as number;
    const lastCost = this.costs.pop() as number;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.costs[0] = lastCost;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let least = at;
        if (
          left < this.items.length &&
          (this.costs[left] as number) < (this.costs[least] as number)
        ) {
          least = left;
        }
        if (
          right < this.items.length &&
          (this.costs[right] as number) < (this.costs[least] as number)
        ) {
          least = right;
        }
        if (least === at) break;
        this.swap(at, least);
        at = least;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [
      this.items[b] as number,
      this.items[a] as number,
    ];
    [this.costs[a], this.costs[b]] = [
      this.costs[b] as number,
      this.costs[a] as number,
    ];
  }
}

const STEPS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * The shortest way through the water between two cells (A*, eight
 * directions, never cutting the corner of a land cell).
 * @param grid - The grid.
 * @param from - Start cell, in the water.
 * @param to - End cell, in the water.
 * @returns The cells from start to end, or `null` when no way exists.
 */
export function waterPath(
  grid: WaterGrid,
  from: Cell,
  to: Cell,
): Cell[] | null {
  if (!isWater(grid, from) || !isWater(grid, to)) return null;
  const { w, h } = grid;
  const start = from[1] * w + from[0];
  const goal = to[1] * w + to[0];
  const cost = new Float64Array(w * h).fill(Number.POSITIVE_INFINITY);
  const came = new Int32Array(w * h).fill(-1);
  const done = new Uint8Array(w * h);
  const guess = (index: number) => {
    const dx = Math.abs((index % w) - to[0]);
    const dy = Math.abs(Math.floor(index / w) - to[1]);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = new Heap();
  cost[start] = 0;
  open.push(start, guess(start));
  while (open.size > 0) {
    const index = open.pop();
    if (index === goal) break;
    if (done[index]) continue;
    done[index] = 1;
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy, step] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWater(grid, [nx, ny])) continue;
      // A diagonal step needs both sides in the water.
      if (dx && dy && !(isWater(grid, [nx, y]) && isWater(grid, [x, ny]))) {
        continue;
      }
      const next = ny * w + nx;
      const reached = (cost[index] as number) + step;
      if (reached < (cost[next] as number)) {
        cost[next] = reached;
        came[next] = index;
        open.push(next, reached + guess(next));
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const path: Cell[] = [];
  for (let index = goal; index !== -1; index = came[index] as number) {
    path.push([index % w, Math.floor(index / w)]);
    if (index === start) break;
  }
  return path.toReversed();
}

/**
 * Whether a straight line between two cells stays in the water (it is
 * walked in small steps, every cell it touches checked).
 * @param grid - The grid.
 * @param a - First cell.
 * @param b - Second cell.
 * @returns Water all along.
 */
export function clearLine(grid: WaterGrid, a: Cell, b: Cell): boolean {
  const ax = a[0] + 0.5;
  const ay = a[1] + 0.5;
  const dx = b[0] + 0.5 - ax;
  const dy = b[1] + 0.5 - ay;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 3);
  for (let step = 0; step <= steps; step++) {
    const ratio = steps === 0 ? 0 : step / steps;
    const x = ax + dx * ratio;
    const y = ay + dy * ratio;
    // The corners the line passes near count as well.
    for (const [ox, oy] of [
      [0, 0],
      [0.3, 0.3],
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
    ] as const) {
      if (!isWater(grid, [Math.floor(x + ox), Math.floor(y + oy)])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * The fewest straight legs along a path: from each turning point, the
 * farthest cell still seen in a straight line.
 * @param grid - The grid.
 * @param path - Cells from start to end.
 * @returns The turning points, start and end included.
 */
export function straightLegs(grid: WaterGrid, path: readonly Cell[]): Cell[] {
  if (path.length < 3) return [...path];
  const kept: Cell[] = [path[0] as Cell];
  let from = 0;
  while (from < path.length - 1) {
    let next = from + 1;
    for (let ahead = path.length - 1; ahead > from + 1; ahead--) {
      if (clearLine(grid, path[from] as Cell, path[ahead] as Cell)) {
        next = ahead;
        break;
      }
    }
    kept.push(path[next] as Cell);
    from = next;
  }
  return kept;
}

/** A point of a route, as the grid sees it. */
interface Spot {
  lat: number;
  lon: number;
}

/** What {@link bendLegs} did. */
export interface BentRoute<P extends Spot> {
  /** The points, with the turning points added where a leg crossed land. */
  points: Array<P | Spot>;
  /** Legs that went round the land. */
  bent: number;
  /** Legs for which no way was found (rank of the leg, from 0). */
  failed: number[];
}

/**
 * Every leg that crosses the land (or the margin, or a zone to avoid) goes
 * round it: the turning points of the shortest way through the water are put
 * between its two points. The points laid by hand all stay; a point in a
 * port or on the shore starts from the nearest water.
 * @param grid - The water.
 * @param points - The route.
 * @param reach - How far a point may be from the water, in cells.
 * @param loose - The water with half the margin: the small turns round a
 * point of land are merged when their legs stay in it.
 * @returns The new points and what was done.
 */
export function bendLegs<P extends Spot>(
  grid: WaterGrid,
  points: readonly P[],
  reach: number,
  loose?: WaterGrid,
): BentRoute<P> {
  const out: Array<P | Spot> = [];
  const failed: number[] = [];
  let bent = 0;
  for (let index = 0; index < points.length; index++) {
    const from = points[index] as P;
    out.push(from);
    const to = points[index + 1];
    if (!to) break;
    const a = nearestWater(grid, cellOf(grid, from.lat, from.lon), reach);
    const b = nearestWater(grid, cellOf(grid, to.lat, to.lon), reach);
    if (!a || !b) {
      failed.push(index);
      continue;
    }
    if (clearLine(grid, a, b)) continue;
    const path = waterPath(grid, a, b);
    if (!path) {
      failed.push(index);
      continue;
    }
    const strict = straightLegs(grid, path);
    const turns = loose ? straightLegs(loose, strict) : strict;
    for (const cell of turns.slice(1, -1)) out.push(cellPosition(grid, cell));
    bent++;
  }
  return { points: out, bent, failed };
}
