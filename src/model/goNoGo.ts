/**
 * Go / no-go of a sailing day, by rules and without AI. The thresholds are
 * those of the reference boat (Dufour 445 Grand Large, 13.6 m, cruising),
 * shifted by the length of the boat, capped by its CE design category,
 * adjusted by its type and the crew. A criterion counts when passed two
 * hours in a row in the sailing window; the light of the day is the worst
 * one, and two orange criteria at the same hour make it red. These are
 * starting values, to be corrected boat by boat.
 */

/** The light. */
export type Light = 'go' | 'prudence' | 'nogo';
/** The point of sail, from the course and the wind. */
export type PointOfSail = 'pres' | 'travers' | 'portant';
/** CE design category (directive 2013/53/EU), or none known. */
export type CeCategory = 'A' | 'B' | 'C' | 'D' | '';
const CE_CATEGORIES = ['A', 'B', 'C', 'D'] as const;
/** Kind of boat. */
export type BoatKind = 'monocoque' | 'multicoque' | 'deriveur';

/** What the thresholds depend on, besides the point of sail. */
export interface BoatProfile {
  /** Length overall, metres; null: the reference boat. */
  loa: number | null;
  ce: CeCategory;
  kind: BoatKind;
  /** Short-handed or little seasoned crew. */
  smallCrew: boolean;
}

/** [orange from, red from]. */
export type Pair = readonly [number, number];

/** The thresholds of a boat. */
export interface Thresholds {
  /** Mean wind, knots, by point of sail. */
  wind: Readonly<Record<PointOfSail, Pair>>;
  /** Gusts, knots, by point of sail. */
  gust: Readonly<Record<PointOfSail, Pair>>;
  /** Significant height, metres. */
  hs: Pair;
  /** Short sea (period under 6 s): Hs, metres. */
  shortHs: Pair;
  /** Convective energy (with little inhibition), J/kg. */
  cape: Pair;
  /** Pressure fall over 3 h, hPa. */
  fall: Pair;
  /** Design limit of the CE category: wind (knots) and Hs (m), or null. */
  cap: { windKn: number; hs: number } | null;
  /** Gusts count only with this gap over the mean wind (0: always). */
  gustGap: number;
}

/** The reference: Dufour 445 GL, 13.6 m. */
export const REFERENCE: Readonly<Omit<Thresholds, 'cap' | 'gustGap'>> = {
  wind: { pres: [18, 25], travers: [20, 28], portant: [22, 30] },
  gust: { pres: [28, 35], travers: [28, 35], portant: [30, 38] },
  hs: [2, 3.5],
  shortHs: [1.5, 2.5],
  cape: [500, 1500],
  fall: [3, 6],
};

/** Design limits of the CE categories: wind (knots) and Hs (m). */
const CE_CAPS: Readonly<
  Record<Exclude<CeCategory, '' | 'A'>, { windKn: number; hs: number }>
> = {
  B: { windKn: 40, hs: 4 },
  C: { windKn: 27, hs: 2 },
  D: { windKn: 16, hs: 0.3 },
};

/**
 * Shift of the thresholds by length: wind (knots) and Hs (m).
 * @param loa - Length, metres.
 * @returns The shifts.
 */
export function lengthShift(loa: number | null): { kn: number; m: number } {
  if (loa == null) return { kn: 0, m: 0 };
  if (loa < 8) return { kn: -6, m: -1 };
  if (loa < 11) return { kn: -3, m: -0.5 };
  if (loa <= 14) return { kn: 0, m: 0 };
  return { kn: 3, m: 0.5 };
}

const plus = ([orange, red]: Pair, shift: number, least: number): Pair => [
  Math.max(least, Math.round((orange + shift) * 10) / 10),
  Math.max(least, Math.round((red + shift) * 10) / 10),
];

/**
 * Corban's rule (20/11/2026): even with a good boat and the full crew, the
 * no-go on the mean wind falls below force 7 (28 knots), so at 27 knots at most.
 */
export const NOGO_WIND_MAX = 27;

const belowForce7 = ([orange, red]: Pair): Pair => {
  const top = Math.min(red, NOGO_WIND_MAX);
  return [Math.min(orange, top - 1), top];
};

/**
 * The thresholds of a boat.
 * @param boat - Its profile.
 * @returns The thresholds.
 */
export function thresholdsOf(boat: BoatProfile): Thresholds {
  const shift = lengthShift(boat.loa);
  const kn = shift.kn - (boat.smallCrew ? 3 : 0);
  const m = shift.m - (boat.smallCrew ? 0.5 : 0);
  const byPoint = (table: Readonly<Record<PointOfSail, Pair>>) => ({
    pres: plus(table.pres, kn, 5),
    travers: plus(table.travers, kn, 5),
    portant: plus(table.portant, kn, 5),
  });
  const wind = byPoint(REFERENCE.wind);
  return {
    wind: {
      pres: belowForce7(wind.pres),
      travers: belowForce7(wind.travers),
      portant: belowForce7(wind.portant),
    },
    gust: byPoint(REFERENCE.gust),
    hs: plus(REFERENCE.hs, m, 0.3),
    shortHs:
      boat.kind === 'deriveur' ? [0.5, 1] : plus(REFERENCE.shortHs, m, 0.3),
    cape: REFERENCE.cape,
    fall: REFERENCE.fall,
    cap: boat.ce === '' || boat.ce === 'A' ? null : CE_CAPS[boat.ce],
    gustGap: boat.kind === 'multicoque' ? 0 : 12,
  };
}

/**
 * The point of sail of a course in a wind.
 * @param course - Course, degrees, or null (no route: close-hauled, the most
 * careful).
 * @param windFrom - Direction the wind comes from, degrees.
 * @returns The point of sail.
 */
export function pointOfSail(
  course: number | null,
  windFrom: number | null,
): PointOfSail {
  if (course == null || windFrom == null) return 'pres';
  const angle = Math.abs(((windFrom - course + 540) % 360) - 180);
  if (angle < 60) return 'pres';
  return angle > 120 ? 'portant' : 'travers';
}

/** One hour of the forecast, as the rules read it. */
export interface Hour {
  /** Epoch milliseconds. */
  t: number;
  windKn: number | null;
  windFrom: number | null;
  gustKn: number | null;
  hs: number | null;
  /** Period of the whole sea, seconds. */
  period: number | null;
  /** Wind sea: height (m) and steepness level (0 to 4, NavIn classes). */
  windSeaHs: number | null;
  windSeaSteep: number | null;
  /** The two trains of waves, for a crossed sea. */
  windSeaDir: number | null;
  swellHs: number | null;
  swellDir: number | null;
  cape: number | null;
  cin: number | null;
  /** Pressure at sea level, hPa. */
  pressure: number | null;
  rain: number | null;
}

/**
 * The course planned: one for all the hours, none (upwind), or one per hour
 * (along a route).
 */
export type Course = number | null | ((hour: Hour) => number | null);

/** One criterion passed at one hour. */
interface Hit {
  /** Which criterion. */
  key: string;
  level: 'prudence' | 'nogo';
  text: string;
}

const fr = (value: number, digits = 0) =>
  (Math.round(value * 10 ** digits) / 10 ** digits)
    .toString()
    .replace('.', ',');

const rate = (
  hits: Hit[],
  key: string,
  value: number | null,
  [orange, red]: Pair,
  say: (value: number, limit: number) => string,
) => {
  if (value == null) return;
  if (value >= red) {
    hits.push({ key, level: 'nogo', text: say(value, red) });
  } else if (value >= orange) {
    hits.push({ key, level: 'prudence', text: say(value, orange) });
  }
};

/**
 * The criteria passed at one hour.
 * @param hour - The hour.
 * @param index - Its place in the day (for the fall of pressure).
 * @param hours - All the hours (3 h before, for the fall).
 * @param limits - The thresholds of the boat.
 * @param course - Planned course, degrees, or null, or one per hour.
 * @returns The hits.
 */
function hitsAt(
  hour: Hour,
  index: number,
  hours: readonly Hour[],
  limits: Thresholds,
  course: Course,
): Hit[] {
  const hits: Hit[] = [];
  const point = pointOfSail(
    typeof course === 'function' ? course(hour) : course,
    hour.windFrom,
  );
  const POINT_WORDS = {
    pres: 'au près',
    travers: 'au travers',
    portant: 'au portant',
  };
  rate(
    hits,
    'wind',
    hour.windKn,
    limits.wind[point],
    (value, limit) =>
      `vent moyen ${fr(value)} nd ≥ ${limit} (${POINT_WORDS[point]})`,
  );
  if (hour.gustKn != null) {
    const gap = hour.gustKn - (hour.windKn ?? 0);
    const [orange, red] = limits.gust[point];
    if (hour.gustKn >= red) {
      hits.push({
        key: 'gust',
        level: 'nogo',
        text: `rafales ${fr(hour.gustKn)} nd ≥ ${red}`,
      });
    } else if (hour.gustKn >= orange && gap >= limits.gustGap) {
      hits.push({
        key: 'gust',
        level: 'prudence',
        text: `rafales ${fr(hour.gustKn)} nd ≥ ${orange} (écart ${fr(gap)} nd)`,
      });
    }
  }
  rate(
    hits,
    'hs',
    hour.hs,
    limits.hs,
    (value, limit) => `Hs ${fr(value, 1)} m ≥ ${fr(limit, 1)}`,
  );
  if (hour.period != null && hour.period < 6) {
    rate(
      hits,
      'short',
      hour.hs,
      limits.shortHs,
      (value, limit) =>
        `mer courte (${fr(hour.period ?? 0, 1)} s), Hs ${fr(value, 1)} m ≥ ${fr(limit, 1)}`,
    );
  }
  if (
    hour.windSeaHs != null &&
    hour.windSeaHs >= 1 &&
    hour.windSeaSteep != null
  ) {
    if (hour.windSeaSteep >= 3) {
      hits.push({
        key: 'steep',
        level: 'nogo',
        text: 'mer du vent critique (cambrure ≥ 1/12)',
      });
    } else if (hour.windSeaSteep >= 2) {
      hits.push({
        key: 'steep',
        level: 'prudence',
        text: 'mer du vent raide et hachée (cambrure ≥ 1/25)',
      });
    }
  }
  if (
    hour.windSeaDir != null &&
    hour.swellDir != null &&
    hour.windSeaHs != null &&
    hour.swellHs != null
  ) {
    const angle = Math.abs(
      ((hour.windSeaDir - hour.swellDir + 540) % 360) - 180,
    );
    const both = Math.min(hour.windSeaHs, hour.swellHs);
    if (angle >= 45 && angle <= 135) {
      if (both >= 2) {
        hits.push({
          key: 'cross',
          level: 'nogo',
          text: `mer croisée (${Math.round(angle)}°, deux trains ≥ 2 m)`,
        });
      } else if (both >= 1) {
        hits.push({
          key: 'cross',
          level: 'prudence',
          text: `mer croisée (${Math.round(angle)}°, deux trains ≥ 1 m)`,
        });
      }
    }
  }
  if (hour.cin == null || hour.cin > -50) {
    rate(
      hits,
      'cape',
      hour.cape,
      limits.cape,
      (value, limit) => `orages possibles : CAPE ${fr(value)} J/kg ≥ ${limit}`,
    );
  }
  const before = hours[index - 3];
  if (before?.pressure != null && hour.pressure != null) {
    const fall = before.pressure - hour.pressure;
    rate(
      hits,
      'fall',
      fall,
      limits.fall,
      (value, limit) =>
        `pression en chute de ${fr(value, 1)} hPa en 3 h ≥ ${limit}`,
    );
  }
  if (limits.cap) {
    if (hour.windKn != null && hour.windKn > limits.cap.windKn) {
      hits.push({
        key: 'ce',
        level: 'nogo',
        text: `au-delà de la catégorie CE (vent > ${limits.cap.windKn} nd)`,
      });
    }
    if (hour.hs != null && hour.hs > limits.cap.hs) {
      hits.push({
        key: 'ce',
        level: 'nogo',
        text: `au-delà de la catégorie CE (Hs > ${fr(limits.cap.hs, 1)} m)`,
      });
    }
  }
  return hits;
}

const RANK: Readonly<Record<Light, number>> = { go: 0, prudence: 1, nogo: 2 };

/**
 * The light of one hour alone (the worst criterion passed), and the point of
 * sail at that hour.
 * @param hour - The hour.
 * @param allHours - All the hours, for the fall of pressure (same objects).
 * @param limits - The thresholds of the boat.
 * @param course - Planned course, degrees, or null, or one per hour.
 * @returns The light and the point of sail.
 */
export function hourLight(
  hour: Hour,
  allHours: readonly Hour[],
  limits: Thresholds,
  course: Course,
): { light: Light; point: PointOfSail } {
  const hits = hitsAt(hour, allHours.indexOf(hour), allHours, limits, course);
  let light: Light = 'go';
  for (const hit of hits) if (RANK[hit.level] > RANK[light]) light = hit.level;
  return {
    light,
    point: pointOfSail(
      typeof course === 'function' ? course(hour) : course,
      hour.windFrom,
    ),
  };
}

/** The light of a day and its reasons. */
export interface DayVerdict {
  light: Light;
  /** Criteria that set the light (passed two hours in a row). */
  reasons: string[];
  /** Criteria passed one hour only: said, without changing the light. */
  isolated: string[];
}

/**
 * The light of the hours of a sailing window.
 * @param hours - The hours of the window, in order.
 * @param allHours - All the hours, for the fall of pressure (same objects).
 * @param limits - The thresholds of the boat.
 * @param course - Planned course, degrees, or null, or one per hour.
 * @returns The light, its reasons, the isolated hours.
 */
export function dayVerdict(
  hours: readonly Hour[],
  allHours: readonly Hour[],
  limits: Thresholds,
  course: Course,
): DayVerdict {
  const perHour = hours.map((hour) =>
    hitsAt(hour, allHours.indexOf(hour), allHours, limits, course),
  );
  let light: Light = 'go';
  const reasons = new Map<string, string>();
  const isolated = new Map<string, string>();
  for (const [index, hits] of perHour.entries()) {
    const next = perHour[index + 1] ?? [];
    const prev = perHour[index - 1] ?? [];
    const lasting = hits.filter(
      (hit) =>
        hit.key === 'ce' ||
        next.some((other) => other.key === hit.key) ||
        prev.some((other) => other.key === hit.key),
    );
    for (const hit of hits) {
      if (!lasting.includes(hit) && !reasons.has(hit.key)) {
        isolated.set(hit.key, `${hit.text} (une heure isolée)`);
      }
    }
    for (const hit of lasting) {
      const level: Light = hit.level;
      if (RANK[level] > RANK[light]) light = level;
      const known = reasons.get(hit.key);
      if (!known || hit.level === 'nogo') reasons.set(hit.key, hit.text);
      isolated.delete(hit.key);
    }
    const oranges = new Set(
      lasting.filter((hit) => hit.level === 'prudence').map((hit) => hit.key),
    );
    if (oranges.size >= 2 && light !== 'nogo') {
      light = 'nogo';
      reasons.set('two', 'deux critères orange en même temps');
    }
  }
  return {
    light,
    reasons: [...reasons.values()],
    isolated: [...isolated.values()],
  };
}

/** Hours over which a measure taken at sea still corrects the forecast. */
export const CORRECTION_HOURS = 6;

/**
 * The forecast corrected by a measure: the ratio measured over forecast at
 * the hour of the measure, fading linearly to nothing over
 * {@link CORRECTION_HOURS} hours.
 * @param forecast - Values of the model, hour by hour.
 * @param times - Their times, epoch ms.
 * @param measure - The measure: value and time, or null.
 * @param measure.value - The value measured.
 * @param measure.t - When, epoch ms.
 * @returns The values corrected.
 */
export function corrected(
  forecast: ReadonlyArray<number | null>,
  times: readonly number[],
  measure: { value: number; t: number } | null,
): Array<number | null> {
  if (!measure) return [...forecast];
  let nearest = -1;
  for (const [index, time] of times.entries()) {
    if (
      nearest < 0 ||
      Math.abs(time - measure.t) < Math.abs((times[nearest] ?? 0) - measure.t)
    ) {
      nearest = index;
    }
  }
  const there = forecast[nearest];
  if (there == null || there <= 0) return [...forecast];
  const ratio = Math.min(4, Math.max(0.25, measure.value / there));
  return forecast.map((value, index) => {
    const hours = ((times[index] ?? 0) - measure.t) / 3_600_000;
    if (value == null || hours < -0.5) return value;
    const weight = Math.max(0, 1 - Math.max(0, hours) / CORRECTION_HOURS);
    return value * (1 + (ratio - 1) * weight);
  });
}

/**
 * The direction corrected by a measure: the offset at the hour of the
 * measure, fading the same way.
 * @param forecast - Directions of the model, degrees.
 * @param times - Their times, epoch ms.
 * @param measure - Direction measured and time, or null.
 * @param measure.value - Degrees.
 * @param measure.t - When, epoch ms.
 * @returns The directions corrected.
 */
export function correctedDirection(
  forecast: ReadonlyArray<number | null>,
  times: readonly number[],
  measure: { value: number; t: number } | null,
): Array<number | null> {
  if (!measure) return [...forecast];
  const index = times.findIndex((time) => time >= measure.t - 1_800_000);
  const there = forecast[index];
  if (there == null) return [...forecast];
  const offset = ((measure.value - there + 540) % 360) - 180;
  return forecast.map((value, at) => {
    const hours = ((times[at] ?? 0) - measure.t) / 3_600_000;
    if (value == null || hours < -0.5) return value;
    const weight = Math.max(0, 1 - Math.max(0, hours) / CORRECTION_HOURS);
    return (value + offset * weight + 360) % 360;
  });
}

/**
 * The length of a boat from its sheet: `loa` in metres, else `loaFt`.
 * @param info - The data of the boat.
 * @returns Metres, or null.
 */
export function boatLength(
  info: Readonly<Record<string, unknown>> | undefined,
): number | null {
  const metres = positive(info?.loa);
  if (metres) return metres;
  const feet = positive(info?.loaFt);
  return feet ? feet * 0.3048 : null;
}

function positive(value: unknown): number | null {
  const text =
    typeof value === 'number'
      ? String(value)
      : typeof value === 'string'
        ? value
        : '';
  const number = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * The CE design category and the kind of a boat, from its sheet (Type and
 * Catégorie de conception CE).
 * @param info - The data of the boat.
 * @returns The category ('' when not given) and the kind (monohull when not given).
 */
export function boatKindOf(
  info: Readonly<Record<string, unknown>> | undefined,
): { ce: CeCategory; kind: BoatKind | null } {
  const ce = info?.ceCategory;
  const hull = info?.hullType;
  return {
    ce: CE_CATEGORIES.find((category) => category === ce) ?? '',
    kind:
      hull === 'Multicoque'
        ? 'multicoque'
        : hull === 'Dériveur'
          ? 'deriveur'
          : hull === 'Monocoque'
            ? 'monocoque'
            : null,
  };
}
