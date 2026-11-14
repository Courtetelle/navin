import { expect, test } from 'vitest';

import { onePlan } from '../planPhoto.ts';
import type { PublishItem } from '../types.ts';

const mark = (id: string): PublishItem => ({
  id,
  name: id,
  sections: [],
  photos: [{ id: `plan:mark:${id}`, cap: `${id} · situation` }],
});

test('several marks shared together get one plan with all of them', () => {
  const list = onePlan('marks', [mark('a'), mark('b'), mark('c')]);
  expect(list.map((item) => item.photos)).toStrictEqual([
    [],
    [],
    [{ id: 'plan:marks:a,b,c', cap: 'Situation des marques' }],
  ]);
});

test('one mark keeps its own plan, and other lists are left alone', () => {
  expect(onePlan('marks', [mark('a')])[0]?.photos).toStrictEqual([
    { id: 'plan:mark:a', cap: 'a · situation' },
  ]);
  const traces = [mark('a'), mark('b')];
  expect(onePlan('traces', traces)).toStrictEqual(traces);
});
