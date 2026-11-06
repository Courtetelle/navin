import { beforeEach, expect, test } from 'vitest';

import { navigation } from '../../../shell/router.ts';
import {
  blankCruise,
  initState,
  saveCruise,
  setCruise,
  setPrep,
  state,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  addCrewDraftPerson,
  setCrewDraftName,
  setCrewDraftRole,
  startCrewDraft,
  toggleCrewDraftMember,
  validateCrewDraft,
} from '../prepCrewDraft.ts';
import { pickBoat, pickDuree, pickPurpose, pickTarif } from '../prepPicks.ts';
import { prepFlow } from '../prepTypes.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
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
