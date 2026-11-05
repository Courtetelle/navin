/**
 * Same WMS image whatever the parameter order or the decimals of the box
 * (offline download of the Vaud maps, legacy sw.js `tileKey`); other tiles
 * keep their request.
 * @param url - Tile URL.
 * @param request - Tile request.
 * @returns The cache key.
 */
export function tileKey<T>(url: URL, request: T): T | string {
  if (!url.hostname.includes('ogc.vd.ch') || !/getmap/i.test(url.search)) {
    return request;
  }
  const parameters: Array<[string, string]> = [];
  for (const [name, value] of url.searchParams) {
    const lower = name.toLowerCase();
    parameters.push([lower, lower === 'bbox' ? roundBox(value) : value]);
  }
  const sorted = parameters.toSorted((first, second) =>
    first[0] < second[0] ? -1 : 1,
  );
  const query = sorted
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
  return `${url.origin}${url.pathname}?${query}`;
}

function roundBox(value: string): string {
  const rounded: string[] = [];
  for (const part of value.split(',')) {
    rounded.push(String(Math.round(Number(part))));
  }
  return rounded.join(',');
}
