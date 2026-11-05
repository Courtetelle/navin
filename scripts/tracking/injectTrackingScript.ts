/**
 * Insert the audience measurement snippet at the end of the page `<head>`.
 * The snippet is taken verbatim; an empty or missing snippet leaves the page unchanged.
 * @param html - Page HTML.
 * @param snippet - Snippet from the TRACKING_SCRIPT variable.
 * @returns The page with the snippet, never added twice.
 */
export function injectTrackingScript(html: string, snippet?: string): string {
  const script = snippet?.trim();
  if (!script || html.includes(script)) return html;
  const head = html.lastIndexOf('</head>');
  if (head === -1) return `${html}\n${script}\n`;
  return `${html.slice(0, head)}${script}\n${html.slice(head)}`;
}
