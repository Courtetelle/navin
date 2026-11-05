import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { applyNmeaSentence, applySignalK } from '../nmeaApply.ts';
import {
  nmeaFresh,
  nmeaLink,
  nmeaLinkView,
  nmeaPosFresh,
  nmeaRedraw,
  nmeaSet,
  nmeaWind,
} from '../nmeaLive.ts';
import { parseNmeaSentence } from '../nmeaParser.ts';

const fixes = vi.hoisted(() => ({
  onFix: vi.fn(),
  trkFix: vi.fn(),
}));

vi.mock('../fixHandler.ts', () => ({ onFix: fixes.onFix }));
vi.mock('../trackerLink.ts', () => ({ trkFix: fixes.trkFix }));

const NOW = Date.UTC(2026, 6, 15, 8);

function apply(line: string): void {
  applyNmeaSentence(parseNmeaSentence(line));
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  nmeaLink.on = true;
  nmeaLink.live = {};
  nmeaLink.at = {};
  nmeaLink.server = undefined;
  fixes.onFix.mockClear();
  fixes.trkFix.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

test('a value is fresh for 15 s; absent and NaN values are ignored', () => {
  nmeaSet('sog', 5);
  nmeaSet('sog', null);
  nmeaSet('sog', Number.NaN);
  expect(nmeaLink.live.sog).toBe(5);
  vi.setSystemTime(NOW + 14_999);
  expect(nmeaFresh('sog')).toBe(true);
  vi.setSystemTime(NOW + 15_000);
  expect(nmeaFresh('sog')).toBe(false);
  expect(nmeaFresh('cog')).toBe(false);
});

test('a redraw publishes the state of the link', () => {
  nmeaLink.status = 'ok';
  nmeaLink.messages = 3;
  nmeaLink.server = 'signalk-server 2.8.0';
  nmeaRedraw();
  expect(nmeaLinkView.value).toStrictEqual({
    on: true,
    status: 'ok',
    error: '',
    messages: 3,
    server: 'signalk-server 2.8.0',
  });
});

test('a position is passed to the journal and the tracker, as instruments', () => {
  apply('$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K');
  apply('$GPGLL,4916.45,N,12311.12,W,225444,A');
  const lat = 49 + 16.45 / 60;
  const lon = -(123 + 11.12 / 60);
  expect(fixes.onFix).toHaveBeenCalledTimes(1);
  expect(fixes.onFix).toHaveBeenCalledWith({
    timestamp: NOW,
    nmea: true,
    coords: {
      latitude: lat,
      longitude: lon,
      accuracy: 5,
      speed: 5.5 / 1.943_844,
      heading: 54.7,
    },
  });
  expect(fixes.trkFix).toHaveBeenCalledWith({
    lat,
    lon,
    acc: 5,
    sog: 5.5,
    cog: 54.7,
  });
  expect(nmeaPosFresh()).toBe(true);
});

test('the instruments stop counting once disconnected', () => {
  apply('$GPGLL,4916.45,N,12311.12,W,225444,A');
  nmeaLink.on = false;
  expect(nmeaPosFresh()).toBe(false);
});

test('a true wind angle gives the direction from the heading', () => {
  apply('$HEHDT,350,T');
  apply('$WIMWV,30,T,10,N,A');
  expect(nmeaWind()).toStrictEqual({ tws: 10, twd: 20 });
});

test('without true wind it is computed from the apparent wind and the boat speed', () => {
  apply('$HEHDT,0,T');
  apply('$VWVHW,,T,,M,10,N,,K');
  apply('$WIMWV,90,R,10,N,A');
  const wind = nmeaWind();
  expect(wind?.tws).toBeCloseTo(14.142_136, 6);
  expect(wind?.twd).toBeCloseTo(135, 9);
});

test('the computed wind needs a heading', () => {
  apply('$WIMWV,90,R,10,N,A');
  expect(nmeaWind()).toBeNull();
});

test('Signal K values are converted from SI units', () => {
  applySignalK({
    updates: [
      {
        values: [
          { path: 'navigation.speedOverGround', value: 3 },
          { path: 'navigation.courseOverGroundTrue', value: Math.PI },
          { path: 'environment.wind.angleApparent', value: -Math.PI / 2 },
          { path: 'environment.water.temperature', value: 295.15 },
          { path: 'environment.depth.belowTransducer', value: 7.5 },
          { path: 'navigation.speedThroughWater', value: 'bad' },
          { path: 'unknown.path', value: 1 },
        ],
      },
    ],
  });
  const { sog, cog, awa, wtemp, depth, stw } = nmeaLink.live;
  expect(sog).toBeCloseTo(5.831_532, 6);
  expect(cog).toBe(180);
  expect(awa).toBe(-90);
  expect(wtemp).toBeCloseTo(22, 9);
  expect(depth).toBe(7.5);
  expect(stw).toBeUndefined();
});

test('a Signal K position is passed on like an NMEA one', () => {
  applySignalK({
    updates: [
      {
        values: [
          {
            path: 'navigation.position',
            value: { latitude: 43.5, longitude: 16.25 },
          },
        ],
      },
    ],
  });
  expect(fixes.onFix).toHaveBeenCalledTimes(1);
  expect(nmeaLink.live.lat).toBe(43.5);
  expect(nmeaLink.live.lon).toBe(16.25);
});

test('the magnetic heading is used only without a fresh true heading', () => {
  applySignalK({
    updates: [{ values: [{ path: 'navigation.headingTrue', value: 1 }] }],
  });
  applySignalK({
    updates: [{ values: [{ path: 'navigation.headingMagnetic', value: 2 }] }],
  });
  expect(nmeaLink.live.hdg).toBeCloseTo(57.295_78, 4);
  vi.setSystemTime(NOW + 15_000);
  applySignalK({
    updates: [{ values: [{ path: 'navigation.headingMagnetic', value: 2 }] }],
  });
  expect(nmeaLink.live.hdg).toBeCloseTo(114.591_56, 4);
});

test('the true wind angle gives the direction when the server has none', () => {
  applySignalK({
    updates: [
      {
        values: [
          { path: 'navigation.headingTrue', value: 0 },
          { path: 'environment.wind.angleTrueWater', value: Math.PI / 2 },
        ],
      },
    ],
  });
  expect(nmeaLink.live.twd).toBe(90);
});

test('the hello of the server gives its name', () => {
  applySignalK({ name: 'signalk-server', version: '2.8.0' });
  expect(nmeaLink.server).toBe('signalk-server 2.8.0');
  applySignalK({ name: 'alone' });
  expect(nmeaLink.server).toBe('signalk-server 2.8.0');
});
