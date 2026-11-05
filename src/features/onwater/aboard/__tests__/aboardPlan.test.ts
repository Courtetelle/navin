import { expect, test } from 'vitest';

import { TASK_TPL_DEFAULT } from '../../../../model/taskTemplate.ts';
import type { Cruise } from '../../../../model/types.ts';
import {
  aboardCrew,
  aboardDays,
  aboardPlan,
  slotIndex,
  taskPlaces,
  taskSlots,
} from '../aboardPlan.ts';

function cruiseWith(extra: Partial<Cruise> = {}): Cruise {
  return {
    id: 'c',
    created: '2026-07-14T08:00:00+02:00',
    info: { du: '2026-07-14', au: '2026-07-16' },
    crew: [],
    entries: [],
    days: {},
    ...extra,
  };
}

test('the crew comes from the list, else from the count chosen', () => {
  expect(aboardCrew(cruiseWith({ taskN: 3 }))).toStrictEqual([
    'Équipier 1',
    'Équipier 2',
    'Équipier 3',
  ]);
  expect(aboardCrew(cruiseWith())).toHaveLength(8);
  const named = cruiseWith({
    crew: [{ nom: ' Léa ' }, { nom: '' }, { nom: 'Noa' }],
  });
  expect(aboardCrew(named)).toStrictEqual(['Léa', 'Noa']);
});

test('the days follow the dates, or a week from the creation', () => {
  expect(aboardDays(cruiseWith())).toStrictEqual([
    '2026-07-14',
    '2026-07-15',
    '2026-07-16',
  ]);
  const noDates = aboardDays(cruiseWith({ info: {} }));
  expect(noDates).toHaveLength(8);
  expect(noDates[0]).toBe('2026-07-14');
  expect(noDates[7]).toBe('2026-07-21');
  const reversed = cruiseWith({
    info: { du: '2026-07-14', au: '2026-07-01' },
  });
  expect(aboardDays(reversed)).toHaveLength(8);
  const long = cruiseWith({
    info: { du: '2026-01-01', au: '2026-12-31' },
  });
  expect(aboardDays(long)).toHaveLength(60);
});

test('each task gets as many slots as people', () => {
  const slots = taskSlots(TASK_TPL_DEFAULT);
  expect(slots.map((slot) => slot.task.id)).toStrictEqual([
    'pdj',
    'pdj',
    'midi',
    'midi',
    'soir',
    'soir',
    'prop',
    'tech',
  ]);
  expect(taskPlaces({ id: 'a', name: 'x', n: 0 })).toBe(1);
  expect(slotIndex(TASK_TPL_DEFAULT, 'soir', 1)).toBe(5);
  expect(slotIndex(TASK_TPL_DEFAULT, 'nope', 0)).toBe(-1);
});

test('each day everyone moves on by one task', () => {
  const plan = aboardPlan(cruiseWith({ taskN: 8 }), TASK_TPL_DEFAULT);
  const people = (day: number, task: number) => plan[day]?.rows[task]?.people;
  expect(people(0, 0)).toStrictEqual([0, 1]);
  expect(people(1, 0)).toStrictEqual([7, 0]);
  expect(people(2, 4)).toStrictEqual([5]);
});

test('the first day starts and the last day ends with the chosen tasks', () => {
  const plan = aboardPlan(cruiseWith(), TASK_TPL_DEFAULT);
  const open = (day: number) =>
    plan[day]?.rows.filter((row) => !row.off).map((row) => row.task.id);
  expect(plan[0]?.first).toBe(true);
  expect(plan[2]?.last).toBe(true);
  expect(open(0)).toStrictEqual(['soir', 'prop', 'tech']);
  expect(open(1)).toHaveLength(5);
  expect(open(2)).toStrictEqual(['pdj']);
});

test('a one-day cruise is a first day only', () => {
  const cruise = cruiseWith({ info: { du: '2026-07-14', au: '2026-07-14' } });
  const [day] = aboardPlan(cruise, TASK_TPL_DEFAULT);
  expect(day?.first).toBe(true);
  expect(day?.last).toBe(false);
});

test('a replacement applies to its day, unless the person left the crew', () => {
  const cruise = cruiseWith({
    taskN: 4,
    taskOv: { '2026-07-15': { 0: 3, 1: 9 } },
  });
  const plan = aboardPlan(cruise, TASK_TPL_DEFAULT);
  expect(plan[1]?.rows[0]?.people).toStrictEqual([3, 0]);
  expect(plan[2]?.rows[0]?.people).toStrictEqual([2, 3]);
});
