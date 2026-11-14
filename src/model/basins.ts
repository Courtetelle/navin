/**
 * The three zones of navigation chosen with NavIn: the Atlantic coasts, the
 * Mediterranean, the lakes. Each one carries what belongs to it only (the
 * tides and the currents to the Atlantic, …): see {@link BASIN_ONLY}.
 */
export const BASIN_CYC = ['atl', 'med', 'lac'] as const;

/** One of the three zones. */
export type Basin = (typeof BASIN_CYC)[number];

/** A sea: the Atlantic or the Mediterranean. */
export type SeaBasin = Exclude<Basin, 'lac'>;

/** The names of the zones, as written on the screen. */
export const BASIN_NAMES: Readonly<Record<Basin, string>> = {
  atl: 'Atlantique',
  med: 'Méditerranée',
  lac: 'Lacs',
};

/**
 * What belongs to some zones only. A section or a field of the app names
 * the zones it is shown in (`basins`); this table says it once for each
 * subject, to keep them together.
 */
export const BASIN_ONLY = {
  /** Tides: times, heights, coefficient. */
  tides: ['atl'],
  /** Tidal currents. */
  currents: ['atl'],
} as const satisfies Readonly<Record<string, readonly Basin[]>>;

/**
 * Whether a section or a field is shown in a zone.
 * @param item - With the zones it belongs to, all when not said.
 * @param item.basins - The zones it belongs to.
 * @param basin - The zone.
 * @returns `true` when shown.
 */
export function inBasin(
  item: { basins?: readonly Basin[] },
  basin: Basin,
): boolean {
  return !item.basins || item.basins.includes(basin);
}

/**
 * The sea of a place: the Mediterranean east of Gibraltar and south of the
 * Alps (the French Atlantic coast left out), else the Atlantic.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns `med` or `atl`.
 */
export function seaAt(lat: number, lon: number): SeaBasin {
  const inBox = lat > 30 && lat < 46 && lon > -5.6 && lon < 36.5;
  const biscay = lat > 42 && lon < 0;
  return inBox && !biscay ? 'med' : 'atl';
}
