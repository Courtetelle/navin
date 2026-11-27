import { beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import {
  addMark,
  createVoyage,
  initState,
  mergeMarks,
  setMarkVoyage,
  state,
} from '../index.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

function markById(id: string) {
  return state.data.marks.value.find((mark) => mark.id === id);
}

test('a new mark joins the active cruise or outing', () => {
  const free = addMark(46.4, 6.3);
  expect(free.voyage).toBeUndefined();
  const outing = createVoyage(['boat'], true, true);
  const mark = addMark(46.45, 6.34);
  expect(markById(mark.id)?.voyage).toBe(outing.id);
});

test('a mark moved to another cruise is newer on the other devices', () => {
  const mark = addMark(46.4, 6.3);
  setMarkVoyage(mark.id, 'v2');
  const moved = markById(mark.id);
  expect(moved?.voyage).toBe('v2');
  expect(moved?.mod).toBeTruthy();
  // An older copy does not undo the move, a newer one does.
  mergeMarks([{ ...moved, voyage: 'v1', mod: '2000-01-01T00:00:00.000Z' }]);
  expect(markById(mark.id)?.voyage).toBe('v2');
  mergeMarks([{ ...moved, voyage: 'v3', mod: '2999-01-01T00:00:00.000Z' }]);
  expect(markById(mark.id)?.voyage).toBe('v3');
  setMarkVoyage(mark.id, undefined);
  expect(markById(mark.id)?.voyage).toBeUndefined();
});
