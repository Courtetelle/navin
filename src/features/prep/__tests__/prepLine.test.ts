import { beforeEach, expect, test } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { prepBarApplies } from '../prepBarSync.ts';
import { prepLineItems, prepPills } from '../prepLine.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('pills of a lake PréP skip the duration', () => {
  expect(prepPills({ step: 2, reach: 2, type: 'lac' })).toStrictEqual([
    { step: 0, label: 1, className: 'done' },
    { step: 2, label: 2, className: 'on' },
    { step: 3, label: 3, className: '' },
    { step: 4, label: 4, className: '' },
    { step: 5, label: 5, className: '' },
  ]);
});

test('pills of a sea PréP skip the type', () => {
  expect(prepPills({ step: 1, reach: 1, type: 'mer' })).toStrictEqual([
    { step: 1, label: 1, className: 'on' },
    { step: 2, label: 2, className: '' },
    { step: 3, label: 3, className: '' },
    { step: 4, label: 4, className: '' },
    { step: 5, label: 5, className: '' },
  ]);
});

test('a consulted step keeps the step being filled', () => {
  const pills = prepPills({ step: 4, reach: 2, type: 'lac' });
  expect(pills[1]).toStrictEqual({ step: 2, label: 2, className: 'on' });
  expect(pills[3]).toStrictEqual({ step: 4, label: 4, className: 'view' });
});

test('a step before the reached one reads done and viewed', () => {
  const pills = prepPills({ step: 2, reach: 3, type: 'lac' });
  expect(pills[1]).toStrictEqual({ step: 2, label: 2, className: 'done view' });
});

test('line of a fresh lake PréP', () => {
  expect(
    prepLineItems({ step: 0, type: 'lac', sub: 'purpose' }, null),
  ).toStrictEqual([
    { text: 'Sortie', target: 0, status: '', current: true },
    { text: 'Bateau', target: 2, status: '', current: false },
    { text: 'Équipage', target: 3, status: '', current: false },
    { text: 'Check-in', target: 4, status: '', current: false },
    { text: 'Départ', target: 5, status: '', current: false },
  ]);
});

test('line of a sea PréP shows the duration and the boat typed', () => {
  expect(
    prepLineItems(
      { step: 2, type: 'mer', duree: 'croisiere', boatName: 'Bronze Kiss' },
      null,
    ).slice(0, 2),
  ).toStrictEqual([
    { text: 'Croisière', target: 1, status: 'ok', current: false },
    { text: 'Bronze Kiss', target: 2, status: 'ok', current: true },
  ]);
});

test('a skipped fare turns orange, a chosen one shows its amount', () => {
  const prep = {
    step: 3,
    type: 'lac',
    purpose: 'Location',
    reach: 3,
    boatId: 'savannah',
  };
  expect(prepLineItems(prep, null)[2]).toStrictEqual({
    text: 'Tarif',
    target: '2t',
    status: 'part',
    current: false,
  });
  const cruise = {
    crew: [],
    tarif: { label: 'Journée', chf: '120' },
  } as unknown as Cruise;
  expect(prepLineItems({ ...prep, tarif: 'Journée' }, cruise)[2]).toStrictEqual(
    { text: 'CHF 120', target: '2t', status: 'ok', current: false },
  );
});

test('a second path adds the paths pill', () => {
  state.data.prepPaths.value = { Location: { t: 'x' } };
  const [first] = prepLineItems(
    { step: 2, type: 'lac', purpose: 'Invitation' },
    null,
  );
  expect(first).toStrictEqual({
    text: '2x',
    target: 'paths',
    status: 'multi',
    current: false,
  });
});

test('the crew being composed turns the title orange', () => {
  const items = prepLineItems(
    {
      step: 3,
      type: 'lac',
      sub: 'crewEdit',
      crewDraft: {
        baseId: null,
        name: '',
        crew: [{ memberId: 'ex1', fonction: 'Skipper' }],
      },
    },
    null,
  );
  expect(items[2]).toStrictEqual({
    text: 'Équipage',
    target: 3,
    status: 'part',
    current: true,
  });
});

test('the PréP bar belongs to the crew page at step 3 and the check-in at step 4', () => {
  expect(prepBarApplies('crew', { step: 3 })).toBe(true);
  expect(prepBarApplies('checklist', { step: 4 })).toBe(true);
  expect(prepBarApplies('crew', { step: 4 })).toBe(false);
  expect(prepBarApplies('checklist', { step: 3 })).toBe(false);
  expect(prepBarApplies('prep', { step: 3 })).toBe(false);
  expect(prepBarApplies('crew', null)).toBe(false);
});
