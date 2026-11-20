import { DOUGLAS, DOUGLAS_EN } from './lists.ts';

/**
 * The combined reading of wind (Beaufort) and sea (Douglas): one colour per
 * kind of conditions, the Douglas degree a wind raises in open sea, and the
 * « B / D » note, read assembled (one sentence) or broken down (each scale).
 */

/** A kind of conditions, one colour. */
export interface ScaleGroup {
  /** French name. */
  fr: string;
  /** English name. */
  en: string;
  /** Colour of the group. */
  color: string;
  /** Text on that colour. */
  ink: string;
  /** Beaufort forces of the group. */
  forces: readonly number[];
  /** Douglas degrees of the group. */
  degrees: readonly number[];
  /** In a few words, French. */
  readFr: string;
  /** In a few words, English. */
  readEn: string;
}

/**
 * The eight kinds of conditions, as the sailors' combined table puts them
 * (checked against the WMO probable wave heights of each force).
 */
export const SCALE_GROUPS: readonly ScaleGroup[] = [
  {
    fr: 'Calme',
    en: 'Calm',
    color: '#e8e8e8',
    ink: '#000',
    forces: [0],
    degrees: [0],
    readFr: 'Calme plat',
    readEn: 'Flat calm',
  },
  {
    fr: 'Très faible',
    en: 'Very light',
    color: '#43a047',
    ink: '#fff',
    forces: [1, 2],
    degrees: [1, 2],
    readFr: 'Petit temps',
    readEn: 'Light airs',
  },
  {
    fr: 'Maniable',
    en: 'Easy',
    color: '#1e66f5',
    ink: '#fff',
    forces: [3, 4],
    degrees: [3],
    readFr: 'Conditions maniables',
    readEn: 'Easy conditions',
  },
  {
    fr: 'Modéré',
    en: 'Moderate',
    color: '#fdd835',
    ink: '#000',
    forces: [5],
    degrees: [4],
    readFr: 'Conditions maniables mais toniques',
    readEn: 'Easy but lively conditions',
  },
  {
    fr: 'Frais',
    en: 'Fresh',
    color: '#fb8c00',
    ink: '#000',
    forces: [6],
    degrees: [5],
    readFr: 'Vent frais : réduire la toile',
    readEn: 'Fresh wind: reduce sail',
  },
  {
    fr: 'Fort',
    en: 'Strong',
    color: '#e53935',
    ink: '#fff',
    forces: [7, 8],
    degrees: [6],
    readFr: 'Vent fort : ris pris, prudence',
    readEn: 'Strong wind: reefed, take care',
  },
  {
    fr: 'Tempête',
    en: 'Storm',
    color: '#8e24aa',
    ink: '#fff',
    forces: [9, 10],
    degrees: [7],
    readFr: 'Tempête : rester à l’abri',
    readEn: 'Storm: stay in shelter',
  },
  {
    fr: 'Extrême',
    en: 'Extreme',
    color: '#111111',
    ink: '#fff',
    forces: [11, 12],
    degrees: [8, 9],
    readFr: 'Conditions extrêmes',
    readEn: 'Extreme conditions',
  },
];

/**
 * The Douglas degree a wind of each Beaufort force raises in open sea, wind
 * established (WMO probable heights: 1 m at force 4, 2 m at 5, 3 m at 6,
 * 4 to 5.5 m at 7 and 8…).
 */
export const SEA_OF_FORCE: readonly number[] = [
  0, 1, 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 9,
];

/** Highest significant height of each Douglas degree, metres. */
const DOUGLAS_TOP = [0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];

/**
 * The group of a Beaufort force.
 * @param force - 0 to 12.
 * @returns Its group.
 */
export function groupOfForce(force: number): ScaleGroup {
  return (SCALE_GROUPS.find((group) => group.forces.includes(force)) ??
    SCALE_GROUPS.at(-1)) as ScaleGroup;
}

/**
 * The group of a Douglas degree.
 * @param degree - 0 to 9.
 * @returns Its group.
 */
export function groupOfDegree(degree: number): ScaleGroup {
  return (SCALE_GROUPS.find((group) => group.degrees.includes(degree)) ??
    SCALE_GROUPS.at(-1)) as ScaleGroup;
}

/**
 * The Douglas degree of a significant wave height.
 * @param height - Metres.
 * @returns 0 to 9.
 */
export function degreeOfHeight(height: number): number {
  let degree = 0;
  while (
    degree < DOUGLAS_TOP.length &&
    height > (DOUGLAS_TOP[degree] as number)
  ) {
    degree++;
  }
  return Math.min(9, degree);
}

/**
 * The weakest Beaufort force whose wind raises such a sea in open sea.
 * @param degree - Douglas degree.
 * @returns The force.
 */
export function forceOfDegree(degree: number): number {
  const force = SEA_OF_FORCE.findIndex((sea) => sea >= degree);
  return force === -1 ? 12 : force;
}

/** What the reader gave: a wind, a sea, a period, each optional. */
export interface CombinedInput {
  /** Mean wind, knots. */
  windKn: number | null;
  /** Significant wave height, metres. */
  waveM: number | null;
  /** Wave period, seconds. */
  periodS: number | null;
}

/** The combined reading. */
export interface Combined {
  force: number;
  degree: number;
  /** The wind was not given: the force raising this sea in open sea. */
  windAuto: boolean;
  /** The sea was not given: the sea this wind raises in open sea. */
  seaAuto: boolean;
  /** Degree this wind raises in open sea. */
  expected: number;
  /** Degree given minus degree expected (0 when one side is theoretical). */
  gap: number;
  windGroup: ScaleGroup;
  seaGroup: ScaleGroup;
  /** « 5 / 4 », with « (4,7 s) » when a period is given. */
  note: string;
}

/**
 * Combine a wind and a sea; the side not given is the open-sea theory.
 * @param input - What the reader gave.
 * @param beaufortOf - Force of a wind in knots.
 * @returns The reading, or null when neither wind nor sea is given.
 */
export function combine(
  input: CombinedInput,
  beaufortOf: (knots: number) => number,
): Combined | null {
  const { windKn, waveM, periodS } = input;
  if (windKn == null && waveM == null) return null;
  const given = waveM == null ? null : degreeOfHeight(waveM);
  const force =
    windKn == null ? forceOfDegree(given as number) : beaufortOf(windKn);
  const expected = SEA_OF_FORCE[force] as number;
  const degree = given ?? expected;
  const both = windKn != null && waveM != null;
  const period =
    periodS != null && periodS > 0 ? ` (${decimal(periodS)} s)` : '';
  return {
    force,
    degree,
    windAuto: windKn == null,
    seaAuto: waveM == null,
    expected,
    gap: both ? degree - expected : 0,
    windGroup: groupOfForce(force),
    seaGroup: groupOfDegree(degree),
    note: `${force} / ${degree}${period}`,
  };
}

/**
 * The assembled reading: the kind of conditions, then what the gap between
 * wind and sea says.
 * @param combined - The reading.
 * @param english - In English.
 * @returns The sentences.
 */
export function assembledReading(
  combined: Combined,
  english: boolean,
): string[] {
  const { windGroup, seaGroup, gap, windAuto, seaAuto, degree } = combined;
  const lines: string[] = [];
  const read = english ? windGroup.readEn : windGroup.readFr;
  if (seaGroup === windGroup) {
    lines.push(`${read}.`);
  } else {
    const sea = english
      ? (DOUGLAS_EN[degree] as string).toLowerCase()
      : (DOUGLAS[degree]?.[1] as string);
    lines.push(
      english ? `${read}, on a ${sea} sea.` : `${read}, sur une mer ${sea}.`,
    );
  }
  if (seaAuto) {
    lines.push(
      english
        ? 'Sea in theory, open sea and established wind (WMO): correct it with the sea you see.'
        : 'Mer théorique, en pleine mer et vent établi (OMM) : corrigez-la avec la mer que vous voyez.',
    );
  } else if (windAuto) {
    lines.push(
      english
        ? 'Wind in theory, the one that raises this sea in open sea (WMO): correct it with the wind you feel.'
        : 'Vent théorique, celui qui lève cette mer en pleine mer (OMM) : corrigez-le avec le vent que vous sentez.',
    );
  } else {
    lines.push(gapReading(gap, english));
  }
  if (Math.abs(gap) >= 2) {
    lines.push(
      english
        ? 'A gap of 2 degrees or more means a change of weather, recent or coming (except on a lake or under a weather shore, where a smaller sea is normal).'
        : 'Un écart de 2 degrés ou plus signale un changement de temps récent ou proche (sauf sur un lac ou sous le vent d’une côte, où une mer plus petite est normale).',
    );
  }
  return lines;
}

function gapReading(gap: number, english: boolean): string {
  if (gap === 0) {
    return english ? 'Wind and sea in phase.' : 'Vent et mer en phase.';
  }
  if (gap === -1) {
    return english
      ? 'Sea a little behind the wind: usual near a coast, on a lake, or while the wind rises.'
      : 'Mer un peu en retard sur le vent : normal près d’une côte, sur un lac ou quand le vent forcit.';
  }
  if (gap < -1) {
    return english
      ? 'Wind much stronger than the sea: sheltered water (short fetch, weather shore) or a wind just risen. Speed and heel; the sea will grow if the wind lasts.'
      : 'Vent bien plus fort que la mer : plan d’eau abrité (fetch court, côte au vent) ou vent qui vient de se lever. Vitesse et gîte ; la mer grossira si le vent dure.';
  }
  return english
    ? 'Sea stronger than the wind: sea left by a blow, or swell from elsewhere. Rolling, sails slamming.'
    : 'Mer plus forte que le vent : mer laissée par un coup de vent, ou houle venue d’ailleurs. Roulis, voiles qui claquent.';
}

/**
 * The broken-down reading: each scale on its own line, with the gap.
 * @param combined - The reading.
 * @param knots - Knots of each force, « 17 à 21 ».
 * @param english - In English.
 * @returns The lines.
 */
export function brokenDownReading(
  combined: Combined,
  knots: (force: number) => string,
  english: boolean,
): string[] {
  const { force, degree, expected, gap, windAuto, seaAuto } = combined;
  const theory = english ? ' (in theory)' : ' (théorique)';
  const seaName = english
    ? (DOUGLAS_EN[degree] as string)
    : (DOUGLAS[degree]?.[1] as string);
  const height = DOUGLAS[degree]?.[2] as string;
  const lines = [
    english
      ? `Wind force ${force} (${knots(force).replace(' à ', ' to ')} kn)${windAuto ? theory : ''}.`
      : `Vent force ${force} (${knots(force)} nœuds)${windAuto ? theory : ''}.`,
    english
      ? `Sea ${degree}, ${seaName.toLowerCase()} (${englishHeight(height)})${seaAuto ? theory : ''}.`
      : `Mer ${degree}, ${seaName} (${height})${seaAuto ? theory : ''}.`,
  ];
  if (!windAuto && !seaAuto) {
    lines.push(gapLine(gap, expected, english));
  }
  return lines;
}

function gapLine(gap: number, expected: number, english: boolean): string {
  if (gap === 0) {
    return english
      ? `Gap: none, this wind raises a sea ${expected} in open sea.`
      : `Écart : aucun, ce vent lève une mer ${expected} en pleine mer.`;
  }
  const size = Math.abs(gap);
  const word = english
    ? `${size} degree${size > 1 ? 's' : ''} ${gap > 0 ? 'above' : 'below'}`
    : `${size} degré${size > 1 ? 's' : ''} ${gap > 0 ? 'au-dessus' : 'en dessous'}`;
  return english
    ? `Gap: the sea is ${word} the sea ${expected} this wind raises in open sea.`
    : `Écart : la mer est ${word} de la mer ${expected} que ce vent lève en pleine mer.`;
}

/**
 * A number with a decimal comma, one decimal at most.
 * @param value - The number.
 * @returns « 4,7 ».
 */
function decimal(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

/**
 * A French height in English.
 * @param height - « 0,5 à 1,25 m ».
 * @returns « 0.5 to 1.25 m ».
 */
export function englishHeight(height: string): string {
  return height
    .replaceAll(' à ', ' to ')
    .replace('plus de', 'over')
    .replaceAll(',', '.');
}

/**
 * Parse a number typed with a comma or a dot.
 * @param text - What was typed.
 * @returns The number, or null when empty or not a number.
 */
export function parseTyped(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
