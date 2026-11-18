/*
 * The sailing CV (« CV nautique ») of a member card: what the renters of
 * boats ask before a charter. Every field is free and may stay empty, so a
 * CV of years and sentences fits as well as a table of boats and miles.
 */

/** Where a navigation took place. */
export type CvWaters = 'mer' | 'lac';

/** One navigation, or one period of navigations. */
export interface CvTrip {
  id: string;
  /** At sea or on a lake. */
  waters: CvWaters;
  /** When: « 2024 », « 1996 – 1998 », « Dès 2015 », « Fin des années 1990 ». */
  when?: string;
  /** The boat: « Dufour 530 ». */
  boat?: string;
  /** Its kind: monohull, catamaran… */
  boatType?: string;
  /** The role aboard: Skipper, Second… */
  role?: string;
  /** Where and what: route, area, regattas. */
  route?: string;
  /** How long: « 7 jours », « une quinzaine de jours par an ». */
  duration?: string;
  /** Nautical miles sailed, as typed. */
  nm?: string;
  /** The charter company the boat was rented from. */
  charter?: string;
}

/** A licence, certificate or training. */
export interface CvCert {
  id: string;
  /** « Permis mer (hauturier) ». */
  label?: string;
  /** When: « 2020 », « 2015 et 2016 ». */
  when?: string;
}

/** The sailing CV of a member. */
export interface MemberCv {
  /** A few words of presentation. */
  intro?: string;
  /** Days sailed in a year: « 15 ». */
  daysPerYear?: string;
  /** Has rented a boat as skipper: Oui or Non, empty when not said. */
  charterSkipper?: string;
  /** Owner of a boat, now or before: Oui or Non, empty when not said. */
  owner?: string;
  /** How many years. */
  ownerYears?: string;
  /** Its type: « Voilier, Surprise ». */
  ownerType?: string;
  /** Its length: « 7,65 m ». */
  ownerLength?: string;
  /** Where it is: « Port de Morges ». */
  ownerPlace?: string;
  /** The place written at the bottom: « Lausanne, le 18.11.2026 ». */
  place?: string;
  trips?: CvTrip[];
  certs?: CvCert[];
}

/** Roles offered (any other can be typed). */
export const CV_ROLES = [
  'Skipper',
  'Co-skipper',
  'Second',
  'Équipier',
] as const;

/** Kinds of boat offered (any other can be typed). */
export const CV_BOAT_TYPES = [
  'Monocoque',
  'Catamaran',
  'Dériveur',
  'Bateau à moteur',
] as const;

/** A period going on: « 2017 – aujourd’hui ». */
const ONGOING = /aujourd.?hui|today|now|à ce jour/i;

/**
 * The year a period is sorted by: the latest year written, the current one
 * for a period still going on (« Dès 2015 »).
 * @param when - The period.
 * @param now - The current year.
 * @returns The year, or 0 without any.
 */
export function cvYear(when: string | undefined, now: number): number {
  const text = when ?? '';
  if (/^\s*(?:dès|depuis|since|from)\b/i.test(text) || ONGOING.test(text)) {
    return now;
  }
  const years = [...text.matchAll(/\b(?:1[89]\d\d|20\d\d)\b/g)].map((match) =>
    Number(match[0]),
  );
  return years.length > 0 ? Math.max(...years) : 0;
}

/**
 * The navigations of a kind of waters, the latest first; a navigation without
 * year keeps its place after the dated ones.
 * @param cv - The CV.
 * @param waters - At sea or on a lake.
 * @param now - The current year.
 * @returns The navigations.
 */
export function cvTrips(
  cv: MemberCv | undefined,
  waters: CvWaters,
  now: number,
): CvTrip[] {
  return (cv?.trips ?? [])
    .filter((trip) => trip.waters === waters)
    .toSorted(
      (first, second) => cvYear(second.when, now) - cvYear(first.when, now),
    );
}

/**
 * The miles of a navigation.
 * @param nm - As typed: « 1 040 », « 150 NM ».
 * @returns The number, 0 when none.
 */
export function cvMiles(nm: string | undefined): number {
  const digits = (nm ?? '').replaceAll(/[\s'’]/g, '').match(/\d+/);
  return digits ? Number(digits[0]) : 0;
}

/** The totals shown on top of a CV. */
export interface CvTotals {
  /** Miles at sea. */
  seaNm: number;
  /** Miles on lakes. */
  lakeNm: number;
  /** Navigations at sea. */
  seaTrips: number;
  /** Of which as skipper or chef de bord. */
  skipperTrips: number;
  /** The first year sailed, 0 when unknown. */
  since: number;
}

/**
 * The totals of a CV.
 * @param cv - The CV.
 * @returns Miles, navigations and first year.
 */
export function cvTotals(cv: MemberCv | undefined): CvTotals {
  const trips = cv?.trips ?? [];
  const sea = trips.filter((trip) => trip.waters === 'mer');
  const years = trips.flatMap((trip) =>
    [...(trip.when ?? '').matchAll(/\b(?:1[89]\d\d|20\d\d)\b/g)].map((match) =>
      Number(match[0]),
    ),
  );
  return {
    seaNm: sum(sea),
    lakeNm: sum(trips.filter((trip) => trip.waters === 'lac')),
    seaTrips: sea.reduce((total, trip) => total + cvTimes(trip.when), 0),
    skipperTrips: sea.reduce((total, trip) => total + skipperTimes(trip), 0),
    since: years.length > 0 ? Math.min(...years) : 0,
  };
}

/**
 * How many navigations a line counts: one a year for a period of years
 * (« 2005 – 2024 », « de 2001 à 2002 », « 2017 – aujourd’hui »), else one.
 * @param when - The period.
 * @param now - The current year.
 * @returns The count.
 */
export function cvTimes(
  when: string | undefined,
  now = new Date().getFullYear(),
): number {
  const text = when ?? '';
  const start = /\b(?<from>(?:19|20)\d\d)\b/.exec(text);
  if (start && ONGOING.test(text)) {
    return Math.max(1, now - Number(start.groups?.from) + 1);
  }
  const range =
    /\b(?<from>(?:19|20)\d\d)\s*(?:[-–—]|à|a|to)\s*(?<to>(?:19|20)\d\d)\b/i.exec(
      when ?? '',
    );
  if (!range) return 1;
  const span = Number(range.groups?.to) - Number(range.groups?.from) + 1;
  return span > 0 ? span : 1;
}

/**
 * How many times a line counts as skipper: « Skipper (2 fois), équipier
 * (1 fois) » says it, else every navigation of the line.
 * @param trip - The navigation.
 * @returns The count, 0 when not skipper.
 */
function skipperTimes(trip: CvTrip): number {
  const role = trip.role ?? '';
  if (!/^(?:skipper|chef de bord)/i.test(role)) return 0;
  const said = /^(?:skipper|chef de bord)\s*\((?<times>\d+)\s*fois\)/i.exec(
    role,
  );
  return said ? Number(said.groups?.times) : cvTimes(trip.when);
}

function sum(trips: readonly CvTrip[]): number {
  return trips.reduce((total, trip) => total + cvMiles(trip.nm), 0);
}

/**
 * Whether a CV holds anything.
 * @param cv - The CV.
 * @returns True with a navigation, a certificate or a word.
 */
export function cvFilled(cv: MemberCv | undefined): boolean {
  return Boolean(
    cv &&
    ((cv.trips?.length ?? 0) > 0 ||
      (cv.certs?.length ?? 0) > 0 ||
      cv.intro ||
      cv.daysPerYear ||
      cv.charterSkipper ||
      cv.owner),
  );
}

/**
 * Miles written the Swiss way: « 1 040 ».
 * @param nm - Miles.
 * @returns The text.
 */
export function cvNmText(nm: number): string {
  return String(nm).replaceAll(/\B(?=(?:\d{3})+(?!\d))/g, ' ');
}

/**
 * What renters ask besides the navigations: since when, days a year, a boat
 * already rented as skipper, a boat owned; only what is said.
 * @param cv - The CV.
 * @param now - The current year.
 * @returns `[question, answer]` lines.
 */
export function cvFacts(
  cv: MemberCv | undefined,
  now: number,
): Array<readonly [string, string]> {
  if (!cv) return [];
  const { since } = cvTotals(cv);
  const lines: Array<readonly [string, string]> = [];
  if (since) {
    lines.push(['Navigue depuis', `${since} (${now - since} ans)`]);
  }
  const days = cv.daysPerYear ? null : cvSeaDays(cv, now);
  if (cv.daysPerYear) {
    lines.push(['Jours de navigation par an', cv.daysPerYear]);
  } else if (days) {
    lines.push([
      'Jours de navigation en mer par an',
      `≈ ${days.perYear} (moyenne ${days.from} – ${days.to})`,
    ]);
  }
  if (cv.charterSkipper) {
    lines.push(['A déjà loué un bateau comme chef de bord', cv.charterSkipper]);
  }
  if (cv.owner) {
    lines.push(['Propriétaire d’un bateau (ou l’a été)', cv.owner]);
  }
  if (cv.owner !== 'Non') {
    for (const [label, value] of [
      ['Depuis combien d’années', cv.ownerYears],
      ['Type de bateau', cv.ownerType],
      ['Longueur', cv.ownerLength],
      ['Lieu', cv.ownerPlace],
    ] as const) {
      if (value) lines.push([label, value]);
    }
  }
  return lines;
}

/**
 * The days of a navigation: « 7 jours », « 2 semaines environ », « 3 nuits
 * et 2 jours » (the nights counted when more).
 * @param duration - As typed.
 * @returns The days, 0 when none said.
 */
export function cvDays(duration = ''): number {
  const count = (unit: RegExp) => {
    const found = unit.exec(duration);
    return found ? Number(found.groups?.n) : 0;
  };
  const weeks = count(/(?<n>\d+)\s*semaines?/i);
  if (weeks) return weeks * 7;
  return Math.max(count(/(?<n>\d+)\s*jours?/i), count(/(?<n>\d+)\s*nuits?/i));
}

/**
 * The days at sea a year, worked out from the durations: all the days, a
 * period of years counted each year, over the years from the first to the
 * last navigation with a duration.
 * @param cv - The CV.
 * @param now - The current year.
 * @returns Days a year and the years, or null without durations.
 */
export function cvSeaDays(
  cv: MemberCv,
  now: number,
): { perYear: number; from: number; to: number } | null {
  let total = 0;
  const years: number[] = [];
  for (const trip of cv.trips ?? []) {
    const days = cvDays(trip.duration);
    if (trip.waters !== 'mer' || !days) continue;
    total += days * cvTimes(trip.when, now);
    const dated = [
      ...(trip.when ?? '').matchAll(/\b(?:1[89]\d\d|20\d\d)\b/g),
    ].map((match) => Number(match[0]));
    years.push(...dated, cvYear(trip.when, now));
  }
  const known = years.filter(Boolean);
  if (!total || known.length === 0) return null;
  const from = Math.min(...known);
  const to = Math.max(...known);
  return { perYear: Math.round(total / (to - from + 1)), from, to };
}
