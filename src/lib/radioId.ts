/**
 * MMSI and call sign of a boat VHF: typed form, and what they tell
 * (number of digits, flag country).
 */

/** Maritime Identification Digits (first 3 of a ship MMSI) → flag. */
const MID_COUNTRIES: Readonly<Record<string, string>> = {
  '203': 'Autriche',
  '205': 'Belgique',
  '209': 'Chypre',
  '210': 'Chypre',
  '211': 'Allemagne',
  '212': 'Chypre',
  '218': 'Allemagne',
  '219': 'Danemark',
  '220': 'Danemark',
  '224': 'Espagne',
  '225': 'Espagne',
  '226': 'France',
  '227': 'France',
  '228': 'France',
  '230': 'Finlande',
  '232': 'Royaume-Uni',
  '233': 'Royaume-Uni',
  '234': 'Royaume-Uni',
  '235': 'Royaume-Uni',
  '238': 'Croatie',
  '239': 'Grèce',
  '240': 'Grèce',
  '241': 'Grèce',
  '244': 'Pays-Bas',
  '245': 'Pays-Bas',
  '246': 'Pays-Bas',
  '247': 'Italie',
  '248': 'Malte',
  '249': 'Malte',
  '250': 'Irlande',
  '253': 'Luxembourg',
  '254': 'Monaco',
  '256': 'Malte',
  '257': 'Norvège',
  '258': 'Norvège',
  '259': 'Norvège',
  '262': 'Monténégro',
  '263': 'Portugal',
  '265': 'Suède',
  '266': 'Suède',
  '269': 'Suisse',
  '271': 'Turquie',
  '278': 'Slovénie',
  '316': 'Canada',
  '366': 'États-Unis',
  '367': 'États-Unis',
  '368': 'États-Unis',
  '369': 'États-Unis',
};

/** ITU call sign prefixes → flag, the longest first where they overlap. */
const CALL_PREFIXES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^H[BE]/, 'Suisse'],
  [/^3A/, 'Monaco'],
  [/^9A/, 'Croatie'],
  [/^9H/, 'Malte'],
  [/^4O/, 'Monténégro'],
  [/^S5/, 'Slovénie'],
  [/^J4/, 'Grèce'],
  [/^O[N-T]/, 'Belgique'],
  [/^OE/, 'Autriche'],
  [/^OH/, 'Finlande'],
  [/^O[U-Z]/, 'Danemark'],
  [/^LX/, 'Luxembourg'],
  [/^L[A-N]/, 'Norvège'],
  [/^S[A-M]/, 'Suède'],
  [/^S[V-Z]/, 'Grèce'],
  [/^C[F-K]/, 'Canada'],
  [/^V[A-GOY]/, 'Canada'],
  [/^C[Q-U]/, 'Portugal'],
  [/^D[A-R]/, 'Allemagne'],
  [/^E[A-H]/, 'Espagne'],
  [/^EI/, 'Irlande'],
  [/^P[A-I]/, 'Pays-Bas'],
  [/^TC/, 'Turquie'],
  [/^A[A-K]/, 'États-Unis'],
  [/^[KNW]/, 'États-Unis'],
  [/^[GM2]/, 'Royaume-Uni'],
  [/^F/, 'France'],
  [/^I/, 'Italie'],
];

/**
 * An MMSI as typed: digits only, 9 at most, grouped by three.
 * @param text - Typed text.
 * @returns e.g. `269 123 456`.
 */
export function mmsiClean(text: string): string {
  return text
    .replaceAll(/\D/g, '')
    .slice(0, 9)
    .replaceAll(/(?<group>\d{3})(?=\d)/g, '$<group> ');
}

/**
 * What an MMSI tells: missing digits, or the flag of the boat.
 * @param text - MMSI.
 * @returns A short note, or `''` when empty.
 */
export function mmsiNote(text: string): string {
  const digits = text.replaceAll(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return 'Commence par 0 : station côtière ou groupe, pas un bateau';
  }
  if (digits.length < 9) return `${digits.length} chiffres sur 9`;
  const mid = digits.slice(0, 3);
  const country = MID_COUNTRIES[mid];
  return country ? `${country} (MID ${mid})` : `MID ${mid}`;
}

/**
 * A call sign as typed: capital letters and digits, 7 at most.
 * @param text - Typed text.
 * @returns e.g. `HBY1234`.
 */
export function callsignClean(text: string): string {
  return text
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

/**
 * What a call sign tells: too short, or the flag of its prefix.
 * @param text - Call sign.
 * @returns A short note, or `''` when empty.
 */
export function callsignNote(text: string): string {
  const sign = callsignClean(text);
  if (!sign) return '';
  if (sign.length < 4) return `${sign.length} caractères sur 4 à 7`;
  if (/^HBY\d{4}$/.test(sign)) return 'Suisse · plaisance';
  const found = CALL_PREFIXES.find(([prefix]) => prefix.test(sign));
  return found ? found[1] : 'Préfixe inconnu';
}
