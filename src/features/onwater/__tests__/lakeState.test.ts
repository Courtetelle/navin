import { expect, test } from 'vitest';

import type { Cruise, Entry } from '../../../model/types.ts';
import { hasEvt, lakeState, lakeTimes, sailHidden } from '../lakeState.ts';

const DAY = '2026-07-15';

function entry(time: string, values: Entry['v']): Entry {
  return { id: time, t: `${DAY}T${time}:00+02:00`, v: values };
}

function cruiseWith(entries: Entry[]): Cruise {
  return {
    id: 'c',
    created: `${DAY}T08:00:00+02:00`,
    info: {},
    crew: [],
    entries,
    days: {},
  };
}

test('an empty day has everything off', () => {
  expect(lakeState(DAY, cruiseWith([]))).toStrictEqual({
    motor: false,
    motorT: null,
    sail: false,
    sailT: null,
    allure: null,
    gv: null,
    avant: null,
    bathing: false,
    bathT: undefined,
  });
});

test('engine and sail are independent switches with their start time', () => {
  const cruise = cruiseWith([
    entry('09:00', { evt: ['Début moteur'] }),
    entry('09:30', { evt: ['Début voile'] }),
    entry('09:45', { evt: ['Changement d’allure'], allure: 'Largue' }),
    entry('10:00', { evt: ['Fin moteur'] }),
  ]);
  const state = lakeState(DAY, cruise);
  expect(state.motor).toBe(false);
  expect(state.motorT).toBeNull();
  expect(state.sail).toBe(true);
  expect(state.sailT).toBe(`${DAY}T09:30:00+02:00`);
  expect(state.allure).toBe('Largue');
});

test('labels of older versions are understood and an arrival stops everything', () => {
  const sailing = cruiseWith([entry('09:00', { evt: ['Voile et moteur'] })]);
  expect(lakeState(DAY, sailing).motor).toBe(true);
  expect(lakeState(DAY, sailing).sail).toBe(true);
  const arrived = cruiseWith([
    entry('09:00', { evt: ['Passage à la voile'] }),
    entry('10:00', { evt: ['Arrivée'] }),
  ]);
  expect(lakeState(DAY, arrived).sail).toBe(false);
});

test('a point of sail older than the hoisting and « Moteur » are ignored', () => {
  const cruise = cruiseWith([
    entry('09:00', { allure: 'Près' }),
    entry('09:30', { evt: ['Début voile'] }),
    entry('09:40', { allure: 'Moteur' }),
  ]);
  expect(lakeState(DAY, cruise).allure).toBeNull();
});

test('the last bathing event decides', () => {
  const started = entry('11:00', { evt: ['Départ baignade'] });
  const running = lakeState(DAY, cruiseWith([started]));
  expect(running.bathing).toBe(true);
  expect(running.bathT).toBe(started.t);
  const ended = cruiseWith([
    started,
    entry('11:30', { evt: ['Retour baignade'] }),
  ]);
  expect(lakeState(DAY, ended).bathing).toBe(false);
});

test('sailHidden hides the point of sail under engine and sails under engine alone', () => {
  const state = lakeState(
    DAY,
    cruiseWith([entry('09:00', { evt: ['Début moteur'] })]),
  );
  expect(sailHidden('allure', state)).toBe(true);
  expect(sailHidden('gv', state)).toBe(true);
  const mixed = { ...state, sail: true };
  expect(sailHidden('allure', mixed)).toBe(true);
  expect(sailHidden('gv', mixed)).toBe(false);
  expect(sailHidden('gv', null)).toBe(false);
});

test('lakeTimes sums the propulsion up to the arrival and keeps the baths', () => {
  const cruise = cruiseWith([
    entry('09:00', { evt: ['Début moteur'] }),
    entry('09:30', { evt: ['Début voile'] }),
    entry('10:00', { evt: ['Fin moteur'] }),
    entry('10:30', { evt: ['Départ baignade'] }),
    entry('10:45', { evt: ['Retour baignade'] }),
    entry('11:00', { evt: ['Arrivée'] }),
  ]);
  const start = Date.parse(`${DAY}T10:30:00+02:00`);
  expect(lakeTimes(DAY, cruise)).toStrictEqual({
    motor: 3_600_000,
    sail: 5_400_000,
    mixed: 1_800_000,
    baths: [[start, start + 900_000]],
  });
});

test('lakeTimes of a past day stops at its last entry, a running bath stays open', () => {
  const cruise = cruiseWith([
    entry('09:00', { evt: ['Début voile'] }),
    entry('09:15', { evt: ['Départ baignade'] }),
  ]);
  const times = lakeTimes(DAY, cruise);
  expect(times.sail).toBe(900_000);
  expect(times.baths).toStrictEqual([
    [Date.parse(`${DAY}T09:15:00+02:00`), null],
  ]);
});

test('hasEvt reads the events of an entry', () => {
  expect(hasEvt(entry('09:00', { evt: ['Départ'] }), 'Départ')).toBe(true);
  expect(hasEvt(entry('09:00', {}), 'Départ')).toBe(false);
});
