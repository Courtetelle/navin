import { stringOf } from '../../lib/format.ts';

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * A sheet value in the list of differences: `—` when empty, cut to 80
 * characters of its HTML form, like the legacy page showed it.
 * @param value - Sheet value.
 * @returns The text.
 */
export function versionValueText(value: unknown): string {
  if (value == null || value === '') return '—';
  const text =
    typeof value === 'object' ? JSON.stringify(value) : stringOf(value);
  const escaped = text
    .replaceAll(/[&<>"']/g, (character) => ENTITIES[character] ?? character)
    .slice(0, 80);
  return escaped
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}
