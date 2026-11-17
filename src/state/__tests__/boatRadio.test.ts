import { afterEach, beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import * as actions from '../actions.ts';
import { state } from '../index.ts';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from './parityHelpers.ts';

let stop: (() => void) | undefined;

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
  actions.updateBoat('exb2', (boat) => {
    boat.info.boat = 'Bise Noire';
    boat.info.mmsi = '269 123 456';
    boat.info.callsign = 'HBY1234';
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  leaveHarnessWorld();
});

function openSea(info: Record<string, unknown>): void {
  const cruise = actions.blankCruise('Corse');
  cruise.type = 'mer';
  Reflect.deleteProperty(cruise, 'boatId');
  Object.assign(cruise.info, info);
  state.data.cruise.value = cruise;
}

test('a sea cruise takes the VHF of the boat sheet of the same name', () => {
  stop = actions.followBoatRadio();
  openSea({ boat: 'bise noire ', mmsi: '227 000 000' });
  expect(state.data.cruise.value?.info.mmsi).toBe('269 123 456');
  expect(state.data.cruise.value?.info.callsign).toBe('HBY1234');
});

test('a VHF typed only in the cruise goes to the boat sheet, never lost', () => {
  actions.updateBoat('exb2', (boat) => {
    Reflect.deleteProperty(boat.info, 'callsign');
  });
  stop = actions.followBoatRadio();
  openSea({ boat: 'Bise Noire', callsign: 'HBY9876' });
  expect(actions.boatById('exb2')?.info.callsign).toBe('HBY9876');
  expect(state.data.cruise.value?.info.callsign).toBe('HBY9876');
});

test('the boat sheet changed or emptied: the cruise follows it', () => {
  stop = actions.followBoatRadio();
  openSea({ boat: 'Bise Noire' });
  actions.updateBoat('exb2', (boat) => {
    boat.info.mmsi = '269 999 000';
    Reflect.deleteProperty(boat.info, 'callsign');
  });
  const boat = actions.boatById('exb2');
  if (boat) actions.syncCruiseFromBoat(boat);
  expect(state.data.cruise.value?.info.mmsi).toBe('269 999 000');
  expect(state.data.cruise.value?.info.callsign).toBeUndefined();
});

test('a VHF changed in a cruise never goes to the boat sheet', () => {
  openSea({ boat: 'Bise Noire' });
  actions.updateCruise((draft) => {
    draft.info.mmsi = '269 555 444';
  });
  actions.syncBoatFromCruise('mmsi');
  expect(actions.boatById('exb2')?.info.mmsi).toBe('269 123 456');
});

test('the cruise sheets show the VHF of the boat, not typed there', () => {
  const radio = actions
    .infoSections()
    .flatMap((section) => section.fields)
    .filter((field) => ['mmsi', 'callsign'].includes(field.key));
  expect(radio.length).toBeGreaterThan(0);
  expect(radio.every((field) => field.fromBoat)).toBe(true);
});

test('a cruise of an unknown boat keeps its own VHF', () => {
  stop = actions.followBoatRadio();
  openSea({ boat: 'Inconnu', mmsi: '227 000 000' });
  expect(state.data.cruise.value?.info.mmsi).toBe('227 000 000');
});
