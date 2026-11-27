import type { CvWaters, MemberCv } from '../../model/memberCv.ts';
import { cvNmText, cvTotals } from '../../model/memberCv.ts';
import type { Member } from '../../model/types.ts';

/** Titles of the navigations, by waters. */
export const WATERS_TITLE: Record<CvWaters, string> = {
  mer: 'Navigations en mer',
  lac: 'Navigations sur les lacs',
};

/**
 * The identity lines a renter needs, as the band of the CV writes them: born
 * and nationality, then phone and mail, then the address.
 * @param member - The card.
 * @returns The lines, each with its parts; the empty ones left out.
 */
export function identity(member: Member): string[][] {
  const text = (key: string) => {
    const value = member[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  return [
    [
      text('naissance') ? `${born(member.sexe)} le ${text('naissance')}` : '',
      text('nationalite'),
    ],
    [text('tel'), text('email')],
    [text('adresse').replaceAll('\n', ', ')],
  ]
    .map((line) => line.filter(Boolean))
    .filter((line) => line.length > 0);
}

/**
 * A number on two digits.
 * @param value - The number.
 * @returns e.g. `07`.
 */
function two(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Today written « 18.11.2026 ».
 * @returns The date.
 */
function today(): string {
  const now = new Date();
  return `${two(now.getDate())}.${two(now.getMonth() + 1)}.${now.getFullYear()}`;
}

/**
 * The line at the bottom: « Lausanne, le 18.11.2026 ».
 * @param cv - The CV.
 * @returns The line.
 */
export function footLine(cv: MemberCv): string {
  return cv.place?.trim()
    ? `${cv.place.trim()}, le ${today()}`
    : `Établi le ${today()}`;
}

/**
 * The tiles of the totals, the empty ones left out.
 * @param cv - The CV.
 * @returns `[value, label]` pairs.
 */
export function tiles(cv: MemberCv): Array<[string, string]> {
  const totals = cvTotals(cv);
  const out: Array<[string, string]> = [];
  if (totals.seaNm) out.push([cvNmText(totals.seaNm), 'milles en mer']);
  if (totals.lakeNm) out.push([cvNmText(totals.lakeNm), 'milles sur les lacs']);
  if (totals.seaTrips) {
    out.push([String(totals.seaTrips), 'navigations en mer']);
  }
  if (totals.skipperTrips) {
    out.push([String(totals.skipperTrips), 'fois skipper en mer']);
  }
  return out;
}

/**
 * « né » or « née », as the card says.
 * @param sex - `sexe` of the card.
 * @returns The word.
 */
function born(sex: unknown): string {
  if (sex === 'Femme') return 'née';
  if (sex === 'Homme') return 'né';
  return 'né·e';
}

/**
 * The miles of a navigation, written the Swiss way when only a number.
 * @param nm - As typed.
 * @returns e.g. `1 640 NM`, empty without miles.
 */
export function nmShown(nm: string | undefined): string {
  const text = (nm ?? '').trim();
  if (!text) return '';
  return /^\d+$/.test(text) ? `${cvNmText(Number(text))} NM` : `${text} NM`;
}
