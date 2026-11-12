import { beforeEach, expect, test } from 'vitest';

import { navigation } from '../../../shell/router.ts';
import {
  blankCruise,
  initState,
  setCruise,
  setPrep,
  setZoneSim,
  state,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { prepBack } from '../prepBack.ts';
import {
  prepBrowseNext,
  prepGo,
  prepJump,
  prepLineJump,
  prepReset,
  prepStart,
} from '../prepFlow.ts';
import { prepFlow } from '../prepTypes.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('on a lake the PréP opens on the three paths', () => {
  setZoneSim('lac');
  prepStart();
  expect(state.data.prep.value).toStrictEqual({
    step: 0,
    reach: 0,
    type: 'lac',
    duree: null,
    boatId: null,
    boatName: '',
    purpose: null,
    sub: 'purpose',
  });
  expect(navigation.value.view).toBe('prep');
});

test('at sea the PréP opens on the duration', () => {
  setZoneSim('mer');
  prepStart();
  expect(prepFlow()?.type).toBe('mer');
  expect(prepFlow()?.step).toBe(1);
  expect(prepFlow()?.reach).toBe(1);
});

test('a quick navigation is completed instead of a new one', () => {
  const cruise = blankCruise('Rapide', null);
  cruise.quick = true;
  cruise.type = 'lac';
  cruise.boatId = 'savannah';
  cruise.info.boat = 'Savannah';
  cruise.purpose = 'Location';
  setCruise(cruise);
  prepStart();
  expect(state.data.prep.value).toStrictEqual({
    step: 0,
    reach: 0,
    fill: true,
    type: 'lac',
    duree: 'jour',
    boatId: 'savannah',
    boatName: 'Savannah',
    purpose: 'Location',
  });
});

test('browsing does not move the step being filled', () => {
  setPrep({ step: 2, reach: 2, type: 'lac' });
  prepGo(3, true);
  expect(prepFlow()?.step).toBe(3);
  expect(prepFlow()?.reach).toBe(2);
  prepGo(3);
  expect(prepFlow()?.reach).toBe(3);
});

test('prepGo stays inside the steps', () => {
  setPrep({ step: 2, reach: 2 });
  prepGo(9);
  expect(prepFlow()?.step).toBe(4);
  prepGo(-1, true);
  expect(prepFlow()?.step).toBe(0);
});

test('step 4 opens the check-in once a navigation is open', () => {
  setPrep({ step: 3, reach: 3 });
  prepGo(4);
  expect(navigation.value.view).toBe('prep');
  setCruise(blankCruise('Test', null));
  prepGo(4);
  expect(navigation.value.view).toBe('checklist');
  expect(navigation.value.arg).toBe('dep');
});

test('the next step of a lake skips the duration', () => {
  setPrep({ step: 0, reach: 0, type: 'lac', sub: 'purpose' });
  prepBrowseNext();
  expect(prepFlow()?.step).toBe(2);
  expect(prepFlow()?.sub).toBeNull();
});

test('nothing follows the last step', () => {
  setPrep({ step: 5, reach: 5, type: 'mer' });
  prepBrowseNext();
  expect(prepFlow()?.step).toBe(5);
});

test('the first step of a lake reopens the paths', () => {
  setPrep({ step: 3, reach: 3, type: 'lac', crewDraft: null });
  prepJump(0);
  expect(prepFlow()?.sub).toBe('purpose');
});

test('the fare is reached from the line only with a boat', () => {
  setPrep({ step: 3, reach: 3, type: 'lac', purpose: 'Location' });
  prepLineJump('2t');
  expect(prepFlow()?.sub).toBeNull();
  setPrep({ step: 3, reach: 3, type: 'lac', boatId: 'savannah' });
  prepLineJump('2t');
  expect(prepFlow()?.sub).toBe('tarif');
  expect(prepFlow()?.step).toBe(2);
});

test('reset forgets only the current path', () => {
  state.data.prepPaths.value = { Location: { t: 'x' }, Invitation: { t: 'y' } };
  setPrep({ step: 3, type: 'lac', purpose: 'Location', boatId: 'savannah' });
  prepReset();
  expect(state.data.prep.value).toStrictEqual({
    step: 0,
    type: 'lac',
    sub: 'purpose',
    fresh: true,
  });
  expect(state.data.prepPaths.value).toStrictEqual({ Invitation: { t: 'y' } });
  expect(state.view.toast.value?.message).toBe(
    'Chemin « Location » effacé · les autres chemins, bateaux et fiches sont conservés',
  );
});

test('reset at sea goes back to the duration', () => {
  setPrep({ step: 3, type: 'mer' });
  prepReset();
  expect(state.data.prep.value).toStrictEqual({
    step: 1,
    type: 'mer',
    sub: null,
    fresh: true,
  });
});

test('back from the first step quits the PréP', () => {
  setPrep({ step: 0, type: 'lac', sub: 'purpose' });
  prepBack();
  expect(state.data.prep.value).toBeNull();
  expect(navigation.value.view).toBe('tracker');
});

test('back from the boats of a lake shows the paths', () => {
  setPrep({ step: 2, reach: 2, type: 'lac', purpose: 'Location' });
  prepBack();
  expect(prepFlow()?.step).toBe(0);
  expect(prepFlow()?.sub).toBe('purpose');
});

test('back from the fare shows the boats', () => {
  setPrep({ step: 2, reach: 2, type: 'lac', sub: 'tarif' });
  prepBack();
  expect(prepFlow()?.step).toBe(2);
  expect(prepFlow()?.sub).toBeNull();
});

test('back from the departure goes to the check-in', () => {
  setPrep({ step: 5, reach: 5, type: 'mer' });
  prepBack();
  expect(prepFlow()?.step).toBe(4);
});

test('reset without a zone known never asks lake or sea first', () => {
  setPrep({ step: 3 });
  prepReset();
  const prep = state.data.prep.value;
  expect(prep?.type === 'lac' || prep?.type === 'mer').toBe(true);
  expect(prep?.type === 'lac' ? prep.sub : prep?.step).toBe(
    prep?.type === 'lac' ? 'purpose' : 1,
  );
});
