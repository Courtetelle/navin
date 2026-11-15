import { expect, test } from 'vitest';

import {
  cloudWords,
  metarRows,
  trendWords,
  visibilityWords,
  weatherWords,
} from '../metarText.ts';

test('the weather of a METAR in French', () => {
  expect(weatherWords('-RA')).toBe('pluie (faible)');
  expect(weatherWords('TSRAGS')).toBe('orage avec pluie et grésil');
  expect(weatherWords('+SHRA')).toBe('averses avec pluie (forte)');
  expect(weatherWords('VCSH')).toBe('averses (à proximité)');
  expect(weatherWords('BR')).toBe('brume');
  expect(weatherWords('XYZ1')).toBe('XYZ1');
});

test('visibility, clouds and the trend of a METAR', () => {
  expect(visibilityWords('6+')).toBe('10 km ou plus');
  expect(visibilityWords(3)).toBe('4,8 km');
  expect(visibilityWords(0.25)).toBe('400 m');
  expect(
    cloudWords([
      { cover: 'SCT', base: 2800 },
      { cover: 'BKNCB', base: 2000 },
    ]),
  ).toBe('nuages épars à 853 m, nuages fragmentés à 610 m (cumulonimbus)');
  expect(
    trendWords(
      'METAR LFRD 151200Z AUTO 22017KT 9999 SCT028 BKN220 14/09 Q1000 TEMPO 24015G35KT 1200 TSRAGS BKN008 BKN020CB',
    ),
  ).toBe(
    'temporairement : vent du 240° 15 nd, rafales 35 nd, visibilité 1200 m, orage avec pluie et grésil, nuages fragmentés à 244 m, nuages fragmentés à 610 m (cumulonimbus)',
  );
  expect(
    trendWords('METAR EGJJ 151150Z 23018G28KT 9999 FEW018 14/09 Q0999 NOSIG'),
  ).toBe('pas de changement significatif prévu');
  const rows = metarRows({
    visib: '6+',
    wx: '-RA',
    dewp: 9,
    raw: 'METAR X NOSIG',
  });
  expect(rows.map(([label]) => label)).toStrictEqual([
    'Visibilité',
    'Temps présent',
    'Point de rosée',
    'Tendance (2 h)',
    'Message METAR',
  ]);
  expect(metarRows(undefined)).toStrictEqual([]);
});
