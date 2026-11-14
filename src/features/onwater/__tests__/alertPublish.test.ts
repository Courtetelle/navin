import { expect, test } from 'vitest';

import { reportRows, snippetZoom, worldPixel } from '../alertPublish.ts';
import { seaRows } from '../seaNow.ts';
import { beaufortOfWaves, seaMarks } from '../windLogic.ts';

const reading = {
  name: 'St-Prex',
  t: Date.UTC(2026, 10, 13, 17, 55),
  avg: 12,
  gust: 20,
  dir: 225,
  km: 6.4,
  net: 'MeteoSwiss',
  lat: 46.48,
  lon: 6.45,
  air: 9.4,
  baro: 1012.6,
};

test('the published alert reads like the station card of LiveMétéo', () => {
  const rows = Object.fromEntries(
    reportRows({
      reading,
      wind: '20 nd en rafales',
      forecast: false,
      boat: null,
    }),
  );
  expect(rows['Vent moyen']).toMatch(/^12 nd/u);
  expect(rows.Rafales).toMatch(/^20 nd/u);
  expect(rows.Direction).toBe('du SO (225°)');
  expect(rows.Force).toBe('4 Bf · Jolie brise');
  expect(rows['Température de l’air']).toBe('9,4 °C');
  expect(rows['Pression (niveau de la mer)']).toBe('1013 hPa');
  expect(rows.Source).toBe('MeteoSwiss');
  expect(rows.Distance).toBe('6 km');
  expect(rows.Position).toBeTruthy();
});

test('a forecast says it is no measurement', () => {
  const rows = Object.fromEntries(
    reportRows({ reading, wind: '20 nd', forecast: true, boat: null }),
  );
  expect(rows['Prévu pour']).toBeTruthy();
  expect(rows.Source).toBe('prévision d’un modèle, pas une mesure');
});

test('the map snippet zooms out until it shows the station and the boat', () => {
  const station = { lat: 46.48, lon: 6.45 };
  expect(snippetZoom(station, null, 1000, 620)).toBe(12);
  expect(snippetZoom(station, { lat: 46.49, lon: 6.47 }, 1000, 620)).toBe(12);
  const far = snippetZoom(station, { lat: 46.3, lon: 6.9 }, 1000, 620);
  expect(far).toBeLessThan(12);
  const a = worldPixel(station.lat, station.lon, far);
  const b = worldPixel(46.3, 6.9, far);
  expect(Math.abs(a.x - b.x)).toBeLessThan(500);
});

test('the five lines of the sea read as in LiveMétéo', () => {
  expect(
    seaRows({
      total: { height: 1.2, dir: 250, period: 6.4 },
      windSea: { height: 0.9, dir: 225, period: 4.2 },
      swell: { height: 0.7, dir: 270, period: 9.6 },
      current: { knots: 0.4, toward: 90 },
      water: 15.3,
      t: 0,
    }),
  ).toStrictEqual([
    ['Mer totale', '1,2 m · 6 s · du OSO'],
    ['Mer du vent', '0,9 m · 4 s · du SO'],
    ['Houle', '0,7 m · 10 s · du O'],
    ['Courant', '0,4 nd · porte vers E'],
    ['Eau', '15,3 °C'],
  ]);
});

test('the marks give the Douglas degree, the Beaufort force of the waves and the WMO reference', () => {
  expect(beaufortOfWaves(0)).toBe(0);
  expect(beaufortOfWaves(1.2)).toBe(5);
  expect(beaufortOfWaves(0.6)).toBe(3);
  expect(beaufortOfWaves(20)).toBe(12);
  const marks = Object.fromEntries(seaMarks(1.2, 5));
  expect(marks.Provenance).toContain('Open-Meteo Marine');
  expect(marks['Échelle de Douglas']).toBe(
    'vagues de 1,2 m = degré 3, mer peu agitée',
  );
  expect(marks['En Beaufort']).toContain('force 5 Bf');
  expect(marks['OMM pour 5 Bf']).toMatch(/^mer 4 agitée, vagues ≈ 2,0 m/u);
});
