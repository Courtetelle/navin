import { PHONE_RE, telOf } from '../../lib/phone.ts';
import type { CrewMember } from '../../model/types.ts';

/** A phone number shown as a big call button. */
export interface CallItem {
  /** Bold line. */
  label: string;
  /** Number as written. */
  number: string;
  /** Text after the number. */
  sub: string;
}

/** A line of a contacts text: call buttons, or static text without a number. */
export type ContactItem =
  | ({ kind: 'call' } & CallItem)
  | { kind: 'static'; label: string; value: string };

/**
 * Turn a contacts text, one per line (`label : value`), into call buttons and
 * static lines (legacy `contactsHtml`). A line may hold several numbers.
 * @param text - Contacts text.
 * @returns The items, in order.
 */
export function contactItems(text: string | undefined | null): ContactItem[] {
  const items: ContactItem[] = [];
  for (const rawLine of (text || '').split('\n')) {
    const line = rawLine.trim();
    if (line) pushLine(items, line);
  }
  return items;
}

/**
 * Crew and relatives call buttons (legacy `crewCallsHtml`).
 * @param crew - Crew of the open cruise.
 * @returns The buttons, in order.
 */
export function crewCalls(crew: readonly CrewMember[]): CallItem[] {
  const calls: CallItem[] = [];
  for (const member of crew) {
    const name = textField(member, 'nom');
    for (const number of textField(member, 'tel').match(PHONE_RE) ?? []) {
      calls.push({
        label: name || 'Équipier',
        number,
        sub: textField(member, 'fonction'),
      });
    }
    const relatives = [
      ['procheNom', 'procheTel'],
      ['proche2Nom', 'proche2Tel'],
      ['proche3Nom', 'proche3Tel'],
    ] as const;
    if (member.procheTel || member.proche2Tel || member.proche3Tel) {
      for (const [nameKey, phoneKey] of relatives) {
        const phone = textField(member, phoneKey);
        if (phone) {
          calls.push({
            label: `Proche de ${name || '…'}`,
            number: phone,
            sub: textField(member, nameKey),
          });
        }
      }
      continue;
    }
    const relative = textField(member, 'proche');
    for (const number of relative.match(PHONE_RE) ?? []) {
      calls.push({
        label: `Proche de ${name || '…'}`,
        number,
        sub: relative
          .replace(PHONE_RE, '')
          .replace(/[\s.]+$/, '')
          .trim(),
      });
    }
  }
  return calls;
}

function textField(member: CrewMember, key: string): string {
  const value = member[key];
  return typeof value === 'string' ? value : '';
}

function pushLine(items: ContactItem[], line: string): void {
  const parts = line.split(/\s*:\s*/);
  const label = parts.length > 1 ? (parts[0] as string) : '';
  const value =
    parts.length > 1 ? parts.slice(1).join(' : ') : (parts[0] as string);
  const numbers = numbersOf(value);
  if (numbers.length === 0) {
    items.push({ kind: 'static', label, value });
    return;
  }
  const rest = value
    .replace(PHONE_RE, '')
    .replaceAll(/\b(?:t[ée]l\.?|ou|or|et)(?=\s|$)/gi, ' ')
    .replaceAll(/[\s,;–]+/g, ' ')
    .replaceAll(/\(\s*\)/g, '')
    .trim();
  for (const number of numbers) {
    items.push({
      kind: 'call',
      label: label || rest,
      number,
      sub: label && rest && rest.length < 40 ? rest : '',
    });
  }
}

function numbersOf(value: string): string[] {
  if (/vhf|canal/i.test(value)) return [];
  if (/^\d{2}$/.test(value.trim())) return [value.trim()];
  const numbers: string[] = [];
  for (const found of value.match(PHONE_RE) ?? []) {
    const number = found.trim();
    if (
      telOf(number).replace('+', '').length >= 3 &&
      !/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(number)
    ) {
      numbers.push(number);
    }
  }
  return numbers;
}
