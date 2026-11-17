import { expect, test } from 'vitest';

import {
  callsignClean,
  callsignNote,
  mmsiClean,
  mmsiNote,
} from '../radioId.ts';

test('an MMSI is typed by groups of three digits, nine at most', () => {
  expect(mmsiClean('269123456')).toBe('269 123 456');
  expect(mmsiClean('2691')).toBe('269 1');
  expect(mmsiClean('269-12a3 45678 9')).toBe('269 123 456');
  expect(mmsiClean('')).toBe('');
});

test('an MMSI tells its flag or what it misses', () => {
  expect(mmsiNote('')).toBe('');
  expect(mmsiNote('269 12')).toBe('5 chiffres sur 9');
  expect(mmsiNote('269 123 456')).toBe('Suisse (MID 269)');
  expect(mmsiNote('227 000 111')).toBe('France (MID 227)');
  expect(mmsiNote('205 000 111')).toBe('Belgique (MID 205)');
  expect(mmsiNote('999 000 111')).toBe('MID 999');
  expect(mmsiNote('002 691 000')).toMatch(/station côtière/);
});

test('a call sign is typed in capitals, letters and digits, seven at most', () => {
  expect(callsignClean('hby 1234')).toBe('HBY1234');
  expect(callsignClean('f-aa12345')).toBe('FAA1234');
});

test('a call sign tells its flag from its ITU prefix', () => {
  expect(callsignNote('')).toBe('');
  expect(callsignNote('HB9')).toBe('3 caractères sur 4 à 7');
  expect(callsignNote('HBY1234')).toBe('Suisse · plaisance');
  expect(callsignNote('HB9999')).toBe('Suisse');
  expect(callsignNote('FAA1234')).toBe('France');
  expect(callsignNote('F12345')).toBe('France');
  expect(callsignNote('ON1234')).toBe('Belgique');
  expect(callsignNote('CG1234')).toBe('Canada');
  expect(callsignNote('9A1234')).toBe('Croatie');
  expect(callsignNote('ZZ1234')).toBe('Préfixe inconnu');
});
