import { expect, test } from 'vitest';

import { SITES } from '../siteCatalog.ts';

test('MeteoSwiss links use www.meteoswiss.admin.ch, never the dead addresses', () => {
  const swiss = SITES.filter((site) =>
    /meteo(?:suisse|swiss|schweiz)/u.test(site.url),
  );
  expect(swiss.length).toBeGreaterThan(0);
  for (const site of swiss) {
    expect(site.url).not.toMatch(/meteosuisse\.admin\.ch\/meteo\//u);
    expect(site.url.startsWith('https://www.meteoswiss.admin.ch/')).toBe(true);
  }
});

test('every site of the bulletin of the zone is in the list', () => {
  const ids = new Set(SITES.map((site) => site.id));
  for (const id of [
    'wx-meteoswiss',
    'wx-meteoswiss-mesures',
    'wx-bms-manche',
    'wx-bms-provence',
    'wx-vigilance',
    'wx-shom-marees',
    'wx-mf-marine',
    'wx-windfinder',
    'wx-meteoconsult',
  ]) {
    expect(ids.has(id)).toBe(true);
  }
});
