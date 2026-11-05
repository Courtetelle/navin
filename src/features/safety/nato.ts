import { textOf } from '../../lib/format.ts';

/** Radio spelling alphabet (ICAO / ITU), by letter or digit. */
export const NATO: Readonly<Record<string, string>> = {
  A: 'Alfa',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  F: 'Foxtrot',
  G: 'Golf',
  H: 'Hotel',
  I: 'India',
  J: 'Juliett',
  K: 'Kilo',
  L: 'Lima',
  M: 'Mike',
  N: 'November',
  O: 'Oscar',
  P: 'Papa',
  Q: 'Quebec',
  R: 'Romeo',
  S: 'Sierra',
  T: 'Tango',
  U: 'Uniform',
  V: 'Victor',
  W: 'Whiskey',
  X: 'X-ray',
  Y: 'Yankee',
  Z: 'Zulu',
  0: 'Zero',
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Niner',
};

/** French pronunciation of the spelling alphabet. */
export const NATO_FR: Readonly<Record<string, string>> = {
  A: 'AL-fa',
  B: 'BRA-vo',
  C: 'TCHAR-li',
  D: 'DEL-ta',
  E: 'EK-o',
  F: 'FOX-trott',
  G: 'GOLF',
  H: 'o-TÈL',
  I: 'IN-di-a',
  J: 'DJOU-li-ett',
  K: 'KI-lo',
  L: 'LI-ma',
  M: 'MAÏK',
  N: 'no-VEMM-beur',
  O: 'OS-kar',
  P: 'pa-PA',
  Q: 'ké-BÈK',
  R: 'RO-mi-o',
  S: 'si-ÈR-ra',
  T: 'TANG-go',
  U: 'YOU-ni-form',
  V: 'VIK-teur',
  W: 'OUIS-ki',
  X: 'EKS-ré',
  Y: 'YANG-ki',
  Z: 'ZOU-lou',
  0: 'ZI-ro',
  1: 'OUANN',
  2: 'TOU',
  3: 'TRI',
  4: 'FO-eur',
  5: 'FA-ïf',
  6: 'SIKS',
  7: 'SÈ-veunn',
  8: 'EÏT',
  9: 'NAÏ-neur',
};

/** Letters and digits of the alphabet grid, in order. */
export const NATO_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

/**
 * Spell a word for the radio (legacy `spell`): letters and digits only.
 * @param text - Word or call sign.
 * @returns e.g. `Hotel Bravo One Two`.
 */
export function spell(text: unknown): string {
  return textOf(text)
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '')
    .split('')
    .map((character) => NATO[character])
    .join(' ');
}

/**
 * Spell a number by groups of three digits (legacy `spellDigits`).
 * @param text - Number, e.g. an MMSI.
 * @returns e.g. `Two Six Nine · Zero Zero Zero`.
 */
export function spellDigits(text: unknown): string {
  return textOf(text)
    .replaceAll(/\D/g, '')
    .replaceAll(/(?<group>\d{3})(?=\d)/g, '$<group> ')
    .split(' ')
    .filter(Boolean)
    .map((group) =>
      group
        .split('')
        .map((digit) => NATO[digit])
        .join(' '),
    )
    .join(' · ');
}
