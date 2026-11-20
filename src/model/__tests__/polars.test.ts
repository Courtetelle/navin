import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { OrcCatalogue } from '../polars.ts';
import {
  bestVmg,
  emptyPolar,
  foldAngle,
  isBoatPolar,
  orcBoat,
  orcYears,
  parsePolar,
  polarSpeed,
  polarToText,
  searchOrc,
} from '../polars.ts';

const catalogue = JSON.parse(
  readFileSync(
    new URL('../../../public/polars/orc.json', import.meta.url),
    'utf8',
  ),
) as OrcCatalogue;

const simple = {
  twa: [40, 90, 180],
  tws: [10, 20],
  kn: [
    [4, 6],
    [6, 8],
    [5, 7],
  ],
};

describe('polarSpeed', () => {
  it('reads the table between its lines and columns', () => {
    expect(polarSpeed(simple, 90, 10)).toBe(6);
    expect(polarSpeed(simple, 65, 15)).toBeCloseTo(6);
    expect(polarSpeed(simple, 135, 20)).toBeCloseTo(7.5);
  });
  it('is the same on either side of the wind', () => {
    expect(polarSpeed(simple, -90, 10)).toBe(6);
    expect(polarSpeed(simple, 270, 10)).toBe(6);
  });
  it('does not sail closer to the wind than its first line', () => {
    expect(polarSpeed(simple, 30, 10)).toBe(0);
  });
  it('keeps the strongest wind above it, falls to 0 below the lightest', () => {
    expect(polarSpeed(simple, 90, 30)).toBe(8);
    expect(polarSpeed(simple, 90, 5)).toBe(3);
    expect(polarSpeed(simple, 90, 0)).toBe(0);
  });
  it('takes the share made', () => {
    expect(polarSpeed(simple, 90, 10, 0.5)).toBe(3);
  });
});

describe('foldAngle', () => {
  it('folds to 0–180', () => {
    expect(foldAngle(200)).toBe(160);
    expect(foldAngle(-30)).toBe(30);
    expect(foldAngle(360)).toBe(0);
  });
});

describe('parsePolar', () => {
  it('reads a .pol with tabs', () => {
    const polar = parsePolar('TWA\\TWS\t6\t10\n52\t4.7\t6.1\n90\t5.4\t6.8\n');
    expect(polar).toStrictEqual({
      twa: [52, 90],
      tws: [6, 10],
      kn: [
        [4.7, 6.1],
        [5.4, 6.8],
      ],
    });
  });
  it('reads a csv with semicolons and decimal commas', () => {
    const polar = parsePolar('twa/tws;10;6\n90;6,8;5,4\n52;6,1;4,7');
    expect(polar).toStrictEqual({
      twa: [52, 90],
      tws: [6, 10],
      kn: [
        [4.7, 6.1],
        [5.4, 6.8],
      ],
    });
  });
  it('reads spaces and missing cells', () => {
    const polar = parsePolar('0 6 10\n45 4\n');
    expect(polar).toStrictEqual({ twa: [45], tws: [6, 10], kn: [[4, 0]] });
  });
  it('says why a text is not a polar', () => {
    expect(parsePolar('hello')).toHaveProperty('error');
    expect(parsePolar('a b c\n1 2 3')).toHaveProperty('error');
    expect(parsePolar('x 6\n200 4')).toHaveProperty('error');
  });
  it('reads back what it writes', () => {
    expect(parsePolar(polarToText(simple))).toStrictEqual(simple);
  });
});

describe('the ORC catalogue', () => {
  it('finds the Hanse 325 of 2011 and the Dufour 445 GL', () => {
    const [hanse] = searchOrc(catalogue, 'hanse 325 2011');
    expect(hanse?.[0]).toBe('Hanse 325');
    const [dufour] = searchOrc(catalogue, 'Dufour 445');
    expect(dufour?.[0]).toBe('Dufour 445 GL');
    expect(searchOrc(catalogue, '  ')).toStrictEqual([]);
  });
  it('makes a polar with the beat and the run', () => {
    const [row] = searchOrc(catalogue, 'Hanse 325');
    const boat = orcBoat(catalogue, row ?? []);
    expect(boat.certificates).toBeGreaterThan(1);
    expect(boat.loa).toBeCloseTo(9.55, 1);
    expect(orcYears(boat)).toMatch(/^\d{4}–\d{4}$/);
    expect(boat.polar.twa[0]).toBeLessThan(52);
    expect(boat.polar.twa.at(-1)).toBe(180);
    expect(boat.polar.kn).toHaveLength(boat.polar.twa.length);
    // 10 kn of wind on the beam: between 6 and 8 kn.
    const speed = polarSpeed(boat.polar, 90, 10);
    expect(speed).toBeGreaterThan(6);
    expect(speed).toBeLessThan(8);
    const beat = bestVmg(boat.polar, 10);
    expect(beat.twa).toBeGreaterThan(35);
    expect(beat.twa).toBeLessThan(55);
    expect(bestVmg(boat.polar, 10, true).twa).toBeGreaterThan(130);
  });
  it('keeps no name of a boat or owner', () => {
    expect(JSON.stringify(catalogue.boats[0]).length).toBeLessThan(500);
    expect(Object.keys(catalogue)).toStrictEqual([
      'src',
      'licence',
      'twa',
      'tws',
      'boats',
    ]);
  });
});

describe('isBoatPolar and emptyPolar', () => {
  it('knows a stored polar', () => {
    const polar = emptyPolar();
    expect(polar.kn).toHaveLength(polar.twa.length);
    expect(
      isBoatPolar({ polar, from: 'hand', label: '', coef: 1, at: '' }),
    ).toBe(true);
    expect(isBoatPolar({ polar: { twa: [1], tws: [], kn: [] }, coef: 1 })).toBe(
      false,
    );
    expect(isBoatPolar(null)).toBe(false);
  });
  it('gives the years of a type', () => {
    expect(orcYears({ from: null, to: null })).toBe('');
    expect(orcYears({ from: 2011, to: 2011 })).toBe('2011');
  });
});
