import { beforeEach, expect, test } from 'vitest';

import { weatherChecks } from '../../model/weatherChecks.ts';
import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { initState } from '../index.ts';
import {
  newWxCheck,
  setWxChecks,
  toggleWxCheck,
  wxCheckState,
  wxChecks,
} from '../wxChecks.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
  setWxChecks(true, null);
  for (const check of wxChecks(true)) {
    if (wxCheckState(true) !== 'none') toggleWxCheck(check.id);
  }
});

test('the weather check colours its button: started, then every point done', () => {
  const checks = wxChecks(true);
  expect(wxCheckState(true)).toBe('none');
  toggleWxCheck(checks[0]?.id ?? '');
  expect(wxCheckState(true)).toBe('part');
  for (const check of checks.slice(1)) toggleWxCheck(check.id);
  expect(wxCheckState(true)).toBe('ok');
});

test('the pencil changes the list of the lake, and it can go back', () => {
  const own = [newWxCheck('Feux de navigation testés')];
  setWxChecks(true, own);
  expect(wxChecks(true)).toStrictEqual(own);
  expect(wxChecks(false)).toStrictEqual(weatherChecks(false));
  setWxChecks(true, null);
  expect(wxChecks(true)).toStrictEqual(weatherChecks(true));
});
