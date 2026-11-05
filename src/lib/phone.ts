import { textOf } from './format.ts';

/** Phone numbers in a text (legacy `PHONE_RE`, global). */
export const PHONE_RE = /\+?\d(?:[ ./-]?\d){2,}/g;

/** Digit groups of the national part, by country code. */
const PHONE_GROUPS: Readonly<Record<string, readonly number[]>> = {
  '41': [2, 3, 2, 2],
  '33': [1, 2, 2, 2, 2],
  '39': [3, 3, 4],
  '49': [3, 4, 4],
  '43': [3, 3, 4],
  '44': [4, 3, 3],
  '32': [3, 2, 2, 2],
  '352': [3, 3, 3],
  '385': [2, 3, 4],
};

/** Relatives of a member card: `[name key, phone key]`. */
export const PROCHES: ReadonlyArray<readonly [string, string]> = [
  ['procheNom', 'procheTel'],
  ['proche2Nom', 'proche2Tel'],
  ['proche3Nom', 'proche3Tel'],
];

/**
 * Digits and `+` of a phone number, for a `tel:` link (legacy `telOf`).
 * @param raw - Number as written.
 * @returns The dialable number.
 */
export function telOf(raw: string): string {
  return raw.replaceAll(/[^\d+]/g, '');
}

/**
 * International format with grouped digits; `00…` becomes `+…`, a national
 * number takes +41 (legacy `intlPhone`).
 * @param raw - Number as typed.
 * @returns e.g. `+41 79 123 45 67`, or `''`.
 */
export function intlPhone(raw: unknown): string {
  let digits = textOf(raw).replaceAll(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = `+${digits.slice(2)}`;
  } else if (digits.startsWith('0')) {
    digits = `+41${digits.slice(1)}`;
  } else if (!digits.startsWith('+')) {
    digits = (digits.length >= 11 ? '+' : '+41') + digits;
  }
  digits = `+${digits.slice(1).replaceAll('+', '')}`;
  const number = digits.slice(1);
  const code =
    ['352', '385'].find((prefix) => number.startsWith(prefix)) ||
    ['41', '33', '39', '49', '43', '44', '32'].find((prefix) =>
      number.startsWith(prefix),
    );
  if (!code) {
    const length = /^[17]/.test(number) ? 1 : 2;
    return `+${number.slice(0, length)} ${number.slice(length).replaceAll(/(?<group>\d{3})(?=\d{3,})/g, '$<group> ')}`;
  }
  let rest = number.slice(code.length).replace(/^0/, '');
  const parts: string[] = [];
  for (const group of PHONE_GROUPS[code] ?? []) {
    if (!rest) break;
    parts.push(rest.slice(0, group));
    rest = rest.slice(group);
  }
  if (rest) parts.push(rest);
  return `+${code} ${parts.join(' ')}`;
}

/**
 * Reformat only the phone numbers inside a text (legacy `intlPhoneIn`).
 * @param text - Free text.
 * @returns The text with international numbers.
 */
export function intlPhoneIn(text: unknown): string {
  return textOf(text).replaceAll(/(?:\+|00)?\d[\d ./-]{6,}\d/g, (match) =>
    intlPhone(match),
  );
}

/**
 * Split an old "Name +41…" relative into name and phone (legacy `splitProche`).
 * @param member - Member card, changed in place.
 * @returns `true` when split.
 */
export function splitProche(member: Record<string, unknown>): boolean {
  if (!member.proche || member.procheNom || member.procheTel) return false;
  const text = textOf(member.proche);
  const phone = text.match(new RegExp(PHONE_RE.source));
  if (phone) {
    member.procheTel = phone[0].trim();
    const name = text
      .replace(phone[0], '')
      .replace(/[\s,;:.-]+$/, '')
      .replace(/^[\s,;:.-]+/, '')
      .trim();
    if (name) member.procheNom = name;
  } else {
    member.procheNom = text.trim();
  }
  return true;
}

/**
 * Phones of a member card in international format and the relatives summary
 * `proche` rebuilt (legacy `normMemberPhones`).
 * @param member - Member card, changed in place.
 * @returns The same card.
 */
export function normMemberPhones<T extends Record<string, unknown>>(
  member: T,
): T {
  const card = member as Record<string, unknown>;
  if (card.tel) card.tel = intlPhone(card.tel);
  splitProche(card);
  for (const [, phoneKey] of PROCHES) {
    if (card[phoneKey]) card[phoneKey] = intlPhone(card[phoneKey]);
  }
  const summary = PROCHES.map(([nameKey, phoneKey]) =>
    [card[nameKey], card[phoneKey]].filter(Boolean).join(' '),
  )
    .filter(Boolean)
    .join(' · ');
  if (summary) card.proche = summary;
  else delete card.proche;
  return member;
}
