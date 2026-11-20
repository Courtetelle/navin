import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  blankCruise,
  boatById,
  setCruise,
  updateBoats,
} from '../../../state/index.ts';
import { onFix } from '../fixHandler.ts';
import { startTracking } from '../liveTracking.ts';
import { nmeaLink } from '../nmeaLive.ts';
import {
  currentSails,
  realPolarsOf,
  sailingBoat,
  setSailsNow,
  steadyMinute,
} from '../polarRecorder.ts';

import {
  NOW,
  fix,
  setUpTracking,
  tearDownTracking,
} from './liveTrackingSetup.ts';

vi.mock('../../../shell/wake.ts', () => ({ applyWake: vi.fn() }));
vi.mock('../trackerLink.ts', () => ({
  drawTrkButtons: vi.fn(),
  loadLinkedDomains: vi.fn(),
  trackerTick: vi.fn(),
  windMuteEnd: vi.fn(),
}));

beforeEach(() => {
  setUpTracking([]);
  updateBoats((boats) => {
    boats.push({ id: 'b1', info: { boat: 'Savannah' } });
  });
  setCruise({ ...blankCruise('Essai'), boatId: 'b1' });
  nmeaLink.live = {};
  nmeaLink.at = {};
});

afterEach(() => {
  nmeaLink.live = {};
  nmeaLink.at = {};
  tearDownTracking();
});

function wind(twd: number, tws: number): void {
  nmeaLink.live.twd = twd;
  nmeaLink.live.tws = tws;
  nmeaLink.at.twd = NOW;
  nmeaLink.at.tws = NOW;
}

const moment = (t: number, hdg: number, twd: number, tws = 12) => ({
  t,
  kn: 6,
  hdg,
  twd,
  tws,
});

const seconds = (count: number) => fix(0, {}, NOW + count * 1000);

test('a steady minute with the wind of the instruments counts for the sails up', () => {
  expect(sailingBoat()?.id).toBe('b1');
  setSailsNow({ gv: '1 ris', avant: 'Code 0' });
  startTracking();
  wind(270, 12);
  for (let second = 0; second <= 60; second += 10) onFix(seconds(second));
  const [real] = realPolarsOf(boatById('b1'));
  expect(real?.sails).toBe('GV 1 ris · Code 0');
  // Heading 222°, wind from 270°: 48° to the wind, 2.6 m/s = 5.1 kn.
  expect(real?.bins['50|12']).toStrictEqual({ n: 1, best: [5.1] });
});

test('nothing counts without the wind of the instruments or under bare poles', () => {
  startTracking();
  for (let second = 0; second <= 60; second += 10) onFix(seconds(second));
  expect(realPolarsOf(boatById('b1'))).toStrictEqual([]);
  wind(270, 12);
  setSailsNow({ gv: 'Affalée', avant: 'Aucune' });
  for (let second = 70; second <= 140; second += 10) onFix(seconds(second));
  expect(realPolarsOf(boatById('b1'))).toStrictEqual([]);
});

test('the sails of a newer logbook entry take over', () => {
  setSailsNow({ gv: 'Haute', avant: 'Génois' });
  vi.setSystemTime(NOW + 60_000);
  setCruise({
    ...blankCruise('Essai'),
    boatId: 'b1',
    entries: [
      {
        id: 'e1',
        t: new Date(NOW + 60_000).toISOString(),
        v: { avant: 'Trinquette' },
      },
    ],
  });
  expect(currentSails()).toStrictEqual({ gv: 'Haute', avant: 'Trinquette' });
});

test('a minute of turning or of a shifting wind does not count', () => {
  expect(steadyMinute([moment(0, 90, 0), moment(1, 90, 0)])).toBeNull();
  expect(
    steadyMinute([moment(0, 90, 0), moment(1, 140, 0), moment(2, 90, 0)]),
  ).toBeNull();
  expect(
    steadyMinute([moment(0, 90, 0), moment(1, 90, 60), moment(2, 90, 0)]),
  ).toBeNull();
  expect(
    steadyMinute([moment(0, 90, 0), moment(1, 90, 0, 20), moment(2, 90, 0)]),
  ).toBeNull();
  expect(
    steadyMinute([moment(0, 350, 260), moment(1, 10, 280), moment(2, 0, 270)]),
  ).toStrictEqual({ twa: expect.closeTo(90, 5), tws: 12, kn: 6 });
});
