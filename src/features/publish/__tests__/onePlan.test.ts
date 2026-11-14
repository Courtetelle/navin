import { afterEach, expect, test } from 'vitest';

import type { Mark } from '../../../model/types.ts';
import { state } from '../../../state/index.ts';
import { groupPlans, markGroups } from '../planPhoto.ts';
import type { PublishItem } from '../types.ts';

const item = (id: string): PublishItem => ({
  id,
  name: id,
  sections: [],
  photos: [{ id: `plan:mark:${id}`, cap: `${id} · situation` }],
});

const mark = (id: string, lat: number, lon: number): Mark =>
  ({ id, n: 1, name: id, at: '', lat, lon }) as Mark;

afterEach(() => {
  state.data.marks.value = [];
});

test('marks closer than 10 NM to one another make one group, step by step', () => {
  const groups = markGroups([
    { id: 'a', lat: 46.45, lon: 6.5 },
    { id: 'b', lat: 48.65, lon: -2.03 },
    { id: 'c', lat: 46.5, lon: 6.6 },
    { id: 'd', lat: 46.55, lon: 6.75 },
  ]);
  expect(groups.map((group) => group.map((one) => one.id))).toStrictEqual([
    ['a', 'c', 'd'],
    ['b'],
  ]);
});

test('one plan under the last mark of each group, the group kept together', () => {
  state.data.marks.value = [
    mark('a', 46.45, 6.5),
    mark('b', 48.65, -2.03),
    mark('c', 46.5, 6.6),
  ];
  const list = groupPlans('marks', [item('a'), item('b'), item('c')]);
  expect(list.map((one) => [one.id, one.photos])).toStrictEqual([
    ['a', []],
    ['c', [{ id: 'plan:marks:a,c', cap: 'Situation · a, c' }]],
    ['b', [{ id: 'plan:marks:b', cap: 'Situation · b' }]],
  ]);
});

test('one mark keeps its own plan, and other lists are left alone', () => {
  expect(groupPlans('marks', [item('a')])[0]?.photos).toStrictEqual([
    { id: 'plan:mark:a', cap: 'a · situation' },
  ]);
  const traces = [item('a'), item('b')];
  expect(groupPlans('traces', traces)).toStrictEqual(traces);
});
