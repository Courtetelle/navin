import { expect, test } from 'vitest';

import type { MemberCv } from '../memberCv.ts';
import {
  cvDays,
  cvFacts,
  cvFilled,
  cvMiles,
  cvNmText,
  cvSeaDays,
  cvTimes,
  cvTotals,
  cvTrips,
  cvYear,
} from '../memberCv.ts';

const CV: MemberCv = {
  trips: [
    { id: 'a', waters: 'mer', when: '2019', role: 'Second', nm: '150' },
    { id: 'b', waters: 'mer', when: '2026', role: 'Skipper', nm: '60' },
    { id: 'c', waters: 'lac', when: 'Dès 2015', nm: '1 640' },
    { id: 'd', waters: 'lac', when: 'Fin des années 1990', nm: '150' },
    { id: 'e', waters: 'mer', route: 'Îles Vierges' },
  ],
};

test('a period is sorted by its latest year, a period going on by now', () => {
  expect(cvYear('1996 – 1998', 2026)).toBe(1998);
  expect(cvYear('Dès 2015', 2026)).toBe(2026);
  expect(cvYear('2017 – aujourd’hui', 2026)).toBe(2026);
  expect(cvYear('Fin des années 1990', 2026)).toBe(1990);
  expect(cvYear('', 2026)).toBe(0);
});

test('the navigations, the latest first, the undated last', () => {
  expect(cvTrips(CV, 'mer', 2026).map((trip) => trip.id)).toStrictEqual([
    'b',
    'a',
    'e',
  ]);
  expect(cvTrips(CV, 'lac', 2026).map((trip) => trip.id)).toStrictEqual([
    'c',
    'd',
  ]);
});

test('the totals: miles, skipper at sea, first year', () => {
  expect(cvMiles('1 040 NM')).toBe(1040);
  expect(cvMiles('')).toBe(0);
  expect(cvTotals(CV)).toStrictEqual({
    seaNm: 210,
    lakeNm: 1790,
    seaTrips: 3,
    skipperTrips: 1,
    since: 1990,
  });
  expect(cvNmText(4300)).toBe('4 300');
});

test('a period of years counts one navigation a year', () => {
  expect(cvTimes('2005 – 2024')).toBe(20);
  expect(cvTimes('de 2001 à 2002')).toBe(2);
  expect(cvTimes('Dès 2015')).toBe(1);
  expect(cvTimes('2017 – aujourd’hui', 2026)).toBe(10);
  const totals = cvTotals({
    trips: [
      { id: 'a', waters: 'mer', when: '2005 – 2024', role: 'Skipper' },
      {
        id: 'b',
        waters: 'mer',
        when: '1996 – 1998',
        role: 'Skipper (2 fois), équipier (1 fois)',
      },
      { id: 'c', waters: 'mer', when: '2000', role: 'Équipier' },
    ],
  });
  expect([totals.seaTrips, totals.skipperTrips]).toStrictEqual([24, 22]);
});

test('only what is said is asked again: nothing about a boat not owned', () => {
  expect(
    cvFacts(
      {
        ...CV,
        daysPerYear: '15',
        charterSkipper: 'Oui',
        owner: 'Non',
        ownerType: 'Surprise',
      },
      2026,
    ),
  ).toStrictEqual([
    ['Navigue depuis', '1990 (36 ans)'],
    ['Jours de navigation par an', '15'],
    ['A déjà loué un bateau comme chef de bord', 'Oui'],
    ['Propriétaire d’un bateau (ou l’a été)', 'Non'],
  ]);
  expect(cvFacts({}, 2026)).toStrictEqual([]);
});

test('a CV is filled with one navigation, one licence or one answer', () => {
  expect(cvFilled(undefined)).toBe(false);
  expect(cvFilled({ trips: [], certs: [] })).toBe(false);
  expect(cvFilled({ charterSkipper: 'Oui' })).toBe(true);
  expect(cvFilled(CV)).toBe(true);
});

test('the days a year at sea are worked out from the durations', () => {
  expect(cvDays('7 jours (du samedi au vendredi soir)')).toBe(7);
  expect(cvDays('2 semaines environ, chaque année')).toBe(14);
  expect(cvDays('3 nuits et 2 jours, non-stop')).toBe(3);
  expect(cvDays('')).toBe(0);
  const cv: MemberCv = {
    trips: [
      { id: 'a', waters: 'mer', when: '2017', duration: '7 jours' },
      { id: 'b', waters: 'mer', when: '2026', duration: '6 jours' },
      { id: 'c', waters: 'lac', when: '2020', duration: '100 jours' },
    ],
  };
  expect(cvSeaDays(cv, 2026)).toStrictEqual({
    perYear: 1,
    from: 2017,
    to: 2026,
  });
  expect(
    cvSeaDays(
      {
        trips: [
          {
            id: 'a',
            waters: 'mer',
            when: '2005 – 2024',
            duration: '2 semaines',
          },
        ],
      },
      2026,
    ),
  ).toStrictEqual({ perYear: 14, from: 2005, to: 2024 });
  expect(cvFacts(cv, 2026)).toContainEqual([
    'Jours de navigation en mer par an',
    '≈ 1 (moyenne 2017 – 2026)',
  ]);
});
