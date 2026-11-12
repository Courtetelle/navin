import { expect, test } from 'vitest';

import { checkInState } from '../prepClose.ts';

test('the close button waits for a first item or an observation', () => {
  expect(checkInState(10, 10, '')).toBe('none');
  expect(checkInState(10, 10, ' '.repeat(3))).toBe('none');
  expect(checkInState(0, 0, '')).toBe('none');
});

test('a started check-in closes as incomplete (orange)', () => {
  expect(checkInState(10, 9, '')).toBe('part');
  expect(checkInState(10, 10, 'Voile d’avant à vérifier')).toBe('part');
});

test('every item green is ready to leave (green), with or without observation', () => {
  expect(checkInState(10, 0, '')).toBe('ok');
  expect(checkInState(10, 0, 'RAS')).toBe('ok');
});
