import { textOf } from '../../lib/format.ts';
import { normMemberPhones } from '../../lib/phone.ts';
import type { Member } from '../../model/types.ts';

import type { BlankForeignLanguage } from './blankTexts.ts';
import {
  BLANK_FIELDS,
  BLANK_HEAD,
  BLANK_I18N,
  BLANK_OLD,
} from './blankTexts.ts';

/** A sheet read from a message: member values, without an id yet. */
export type ParsedSheet = Partial<Member>;

interface RawSheet {
  language?: BlankForeignLanguage;
  values: Record<string, string>;
}

const FOREIGN = Object.keys(BLANK_I18N) as BlankForeignLanguage[];
const FOREIGN_TEXTS = Object.values(BLANK_I18N);

const LABELS: ReadonlyArray<readonly [string, string]> = [
  ...BLANK_FIELDS,
  ...BLANK_OLD,
  ...FOREIGN_TEXTS.flatMap((texts) => Object.entries(texts.labels)),
]
  .map(([key, label]) => [key, normLabel(label)] as const)
  .toSorted((first, second) => second[1].length - first[1].length);

const HEADS = [BLANK_HEAD, ...FOREIGN_TEXTS.map((texts) => texts.head)].map(
  (head) => normLabel(head).slice(0, 18),
);

const INSTRUCTIONS = [
  'ou',
  'ne remplis rien',
  'ici tu remplis',
  ...FOREIGN_TEXTS.flatMap((texts) =>
    [texts.or, texts.leaveBlank, texts.choice].map((text) =>
      normLabel(text).slice(0, 14),
    ),
  ),
];

const THANKS = [
  'merci de compl',
  ...FOREIGN_TEXTS.map((texts) => normLabel(texts.fillIn).slice(0, 14)),
];

/**
 * Comparable form of a label: no accents, no punctuation, lower case (legacy
 * `normLab`).
 * @param text - Label or value.
 * @returns The normalized text.
 */
export function normLabel(text: unknown): string {
  return String(text)
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[ᵉᵐ]/g, 'e')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Read one or several pasted messages: each « NavIn · Fiche » starts a new
 * sheet, every label of every language is recognised (legacy `parseBlank`).
 * @param text - Pasted text.
 * @returns The sheets with a first or last name.
 */
export function parseBlank(text: unknown): ParsedSheet[] {
  const sheets: ParsedSheet[] = [];
  for (const raw of readSheets(String(text))) {
    const sheet = finishSheet(raw);
    if (sheet.prenom || sheet.nom) sheets.push(sheet);
  }
  return sheets;
}

/**
 * Existing cards that look like a received sheet: same name, phone, email or
 * identity document (legacy `memberClones`).
 * @param sheet - Received sheet.
 * @param members - Existing cards.
 * @returns The similar cards.
 */
export function memberClones(
  sheet: ParsedSheet,
  members: readonly Member[],
): Member[] {
  return members.filter(
    (member) =>
      (norm(member.prenom) &&
        norm(member.prenom) === norm(sheet.prenom) &&
        norm(member.nom) === norm(sheet.nom)) ||
      (digits(sheet.tel).length > 6 &&
        digits(member.tel) === digits(sheet.tel)) ||
      (sheet.email && norm(member.email) === norm(sheet.email)) ||
      (sheet.piece && norm(member.piece) === norm(sheet.piece)),
  );
}

function norm(value: unknown): string {
  return normLabel(textOf(value));
}

function digits(value: unknown): string {
  return textOf(value).replaceAll(/\D/g, '');
}

function readSheets(text: string): RawSheet[] {
  const sheets: RawSheet[] = [];
  let current: RawSheet | null = null;
  let last: string | null = null;
  for (const raw of text.replaceAll('\r', '').split('\n')) {
    const line = raw.replaceAll(/^[\s*_~>-]+|[\s*_~]+$/g, '');
    const normalized = normLabel(line);
    const head = HEADS.findIndex((item) => normalized.startsWith(item));
    if (head !== -1) {
      current = { values: {}, language: FOREIGN[head - 1] };
      sheets.push(current);
      last = null;
      continue;
    }
    const colon = line.indexOf(':');
    const label = colon > 0 ? normLabel(line.slice(0, colon)) : null;
    const hit = LABELS.find(([, text]) => text === label);
    if (hit) {
      if (!current) {
        current = { values: {} };
        sheets.push(current);
      }
      last = hit[0];
      const value = line.slice(colon + 1).trim();
      if (value) current.values[last] = value;
      continue;
    }
    if (isInstruction(normalized)) {
      last = null;
      continue;
    }
    const continuation =
      current && last && line.trim() && !isThanks(normalized);
    if (continuation && current && last) {
      const before = current.values[last];
      current.values[last] = `${before ? `${before}\n` : ''}${line.trim()}`;
    }
  }
  return sheets;
}

function isInstruction(line: string): boolean {
  return INSTRUCTIONS.some((text) =>
    text.length < 7 ? line === text : line.startsWith(text),
  );
}

function isThanks(line: string): boolean {
  return THANKS.some((text) => line.startsWith(text));
}

function finishSheet({ language, values }: RawSheet): ParsedSheet {
  const sheet: Record<string, unknown> = { ...values };
  if (values.sexe) {
    const sex = sexOf(normLabel(values.sexe), language === 'es');
    if (sex) sheet.sexe = sex;
    else delete sheet.sexe;
  }
  for (const [key, type] of [
    ['pieceCI', 'Carte d’identité'],
    ['piecePP', 'Passeport'],
  ] as const) {
    const value = values[key];
    if (value) {
      if (!sheet.pieceType) sheet.pieceType = type;
      if (
        !sheet.piece &&
        /\d/.test(value) &&
        value.replaceAll(/\W/g, '').length > 4
      ) {
        sheet.piece = value.trim();
      }
    }
    Reflect.deleteProperty(sheet, key);
  }
  if (sheet.pieceType) {
    const type = documentType(normLabel(sheet.pieceType));
    if (type) sheet.pieceType = type;
    else delete sheet.pieceType;
  }
  return normMemberPhones(sheet);
}

function sexOf(text: string, spanish: boolean): string | undefined {
  if (spanish && /^m(?:ujer)?$/.test(text)) return 'Femme';
  if (/^(?:f|w|d|femme|female|woman|women|donna|mujer)/.test(text)) {
    return 'Femme';
  }
  if (/^(?:h|homme|m|u|male|man|uomo|hombre)/.test(text)) return 'Homme';
  return undefined;
}

function documentType(text: string): string | undefined {
  if (/carte|id|identit|documento/.test(text)) return 'Carte d’identité';
  if (text.includes('pass')) return 'Passeport';
  return undefined;
}
