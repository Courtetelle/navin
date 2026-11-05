import { beforeEach, expect, test } from 'vitest';

import { navigation } from '../../../shell/router.ts';
import {
  blankCruise,
  initState,
  saveCruise,
  setCruise,
  setPrep,
  setZoneSim,
  state,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { prepBack } from '../prepBack.ts';
import {
  addCrewDraftPerson,
  setCrewDraftName,
  setCrewDraftRole,
  startCrewDraft,
  toggleCrewDraftMember,
  validateCrewDraft,
} from '../prepCrewDraft.ts';
import {
  prepBrowseNext,
  prepGo,
  prepJump,
  prepLineJump,
  prepReset,
  prepStart,
} from '../prepFlow.ts';
import { pickBoat, pickDuree, pickPurpose, pickTarif } from '../prepPicks.ts';
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
  expect(prepFlow()?.step).toBe(5);
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

test('a new path starts from the boats', () => {
  setPrep({ step: 0, type: 'lac', sub: 'purpose', boatId: 'old', reach: 4 });
  pickPurpose('Entraînement');
  expect(state.data.prep.value).toStrictEqual({
    step: 2,
    type: 'lac',
    sub: null,
    purpose: 'Entraînement',
    crewDraft: null,
    newCrew: false,
    duree: 'jour',
    fresh: true,
    reach: 2,
  });
});

test('a kept path is resumed at the step it reached', () => {
  state.data.prepPaths.value = {
    Invitation: {
      purpose: 'Invitation',
      duree: 'jour',
      boatId: 'exb1',
      step: 3,
      reach: 3,
      t: 'x',
    },
  };
  setPrep({ step: 0, type: 'lac', sub: 'purpose' });
  pickPurpose('Invitation');
  expect(prepFlow()?.step).toBe(3);
  expect(prepFlow()?.boatId).toBe('exb1');
  expect(prepFlow()?.t).toBeUndefined();
});

test('choosing a boat opens the outing with its purpose', () => {
  setPrep({
    step: 2,
    reach: 2,
    type: 'lac',
    purpose: 'Invitation',
    duree: 'jour',
  });
  pickBoat('exb1');
  const cruise = state.data.cruise.value;
  expect(cruise?.boatId).toBe('exb1');
  expect(cruise?.purpose).toBe('Invitation');
  expect(prepFlow()?.cruiseId).toBe(cruise?.id);
  expect(prepFlow()?.step).toBe(3);
  expect(state.data.prepUse.value.boat[0]?.id).toBe('exb1');
  expect(state.data.prepUse.value.boat[0]?.p).toBe('Invitation');
});

test('a rental goes through the fares and writes the amount of the day', () => {
  setPrep({
    step: 2,
    reach: 2,
    type: 'lac',
    purpose: 'Location',
    duree: 'jour',
  });
  pickBoat('savannah');
  expect(prepFlow()?.sub).toBe('tarif');
  expect(prepFlow()?.step).toBe(2);
  pickTarif(1);
  const cruise = state.data.cruise.value;
  expect(cruise?.tarif).toStrictEqual({
    label: 'Soir dès 17h00 en semaine',
    chf: '60',
    line: 'Soir dès 17h00 en semaine : CHF 60.–',
  });
  const days = Object.values(cruise?.days ?? {});
  expect(days[0]?.typeSortie).toBe('Location');
  expect(days[0]?.montant).toBe('60');
  expect(prepFlow()?.tarif).toBe('Soir dès 17h00 en semaine');
  expect(prepFlow()?.step).toBe(3);
});

test('no fare leaves nothing on the outing', () => {
  setCruise(blankCruise('Test', null));
  saveCruise();
  setPrep({ step: 2, type: 'lac', boatId: 'savannah', sub: 'tarif' });
  pickTarif(null);
  expect(state.data.cruise.value?.tarif).toBeUndefined();
  expect(prepFlow()?.tarif).toBe('Sans tarif');
});

test('a sea cruise is named after the boat typed', () => {
  setPrep({ step: 1, reach: 1, type: 'mer', boatName: 'Tiki' });
  pickDuree('croisiere');
  expect(prepFlow()?.duree).toBe('croisiere');
  expect(prepFlow()?.step).toBe(2);
});

test('a crew composed becomes a new composition', () => {
  setCruise(blankCruise('Test', null));
  saveCruise();
  setPrep({ step: 3, reach: 3, type: 'lac', purpose: 'Invitation' });
  startCrewDraft();
  toggleCrewDraftMember('ex2');
  toggleCrewDraftMember('ex5');
  expect(prepFlow()?.crewDraft?.crew).toStrictEqual([
    { memberId: 'ex2', fonction: 'Skipper' },
    { memberId: 'ex5', fonction: 'Équipier' },
  ]);
  setCrewDraftRole(1, 'Skipper');
  expect(prepFlow()?.crewDraft?.crew).toStrictEqual([
    { memberId: 'ex2', fonction: 'Équipier' },
    { memberId: 'ex5', fonction: 'Skipper' },
  ]);
  setCrewDraftName('  Les amis ');
  validateCrewDraft();
  const set = state.data.crewSets.value.at(-1);
  expect(set?.ident).toBe('EQ004');
  expect(set?.name).toBe('Les amis');
  expect(state.data.cruise.value?.crew).toHaveLength(2);
  expect(prepFlow()?.sub).toBeNull();
  expect(prepFlow()?.crewDraft).toBeNull();
  expect(navigation.value.view).toBe('checklist');
});

test('adding a person opens the crew page with the crew on board', () => {
  setCruise(blankCruise('Test', null));
  saveCruise();
  setPrep({ step: 3, reach: 3, type: 'lac' });
  startCrewDraft();
  toggleCrewDraftMember('ex1');
  addCrewDraftPerson();
  expect(prepFlow()?.newCrew).toBe(true);
  expect(state.data.cruise.value?.crew).toHaveLength(1);
  expect(navigation.value.view).toBe('crew');
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
