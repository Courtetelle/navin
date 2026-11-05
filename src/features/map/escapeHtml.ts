const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a text placed in the HTML of a Leaflet popup (legacy `esc`): Leaflet
 * takes its popup content as a string, outside React.
 * @param value - Text.
 * @returns The escaped text.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '').replaceAll(
    /[&<>"']/g,
    (character) => ENTITIES[character] ?? '',
  );
}
