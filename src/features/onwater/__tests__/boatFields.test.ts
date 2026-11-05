import { expect, test } from 'vitest';

import type { Boat } from '../../../model/types.ts';
import {
  addLabel,
  flatLabels,
  moveLabel,
  removeLabel,
  renameStandard,
  standardLabel,
} from '../boatFields.ts';

function boat(): Boat {
  return { id: 'b', info: {}, custom: [] };
}

function firstField(): { key: string; label: string } {
  const line = flatLabels(boat()).find((item) => item.key);
  return { key: line?.key ?? '', label: line?.label ?? '' };
}

test('flatLabels lists section titles and labels', () => {
  const lines = flatLabels(boat());
  expect(lines[0]?.sec).toBeDefined();
  expect(lines[0]?.key).toBeUndefined();
  expect(lines[1]?.cid).toBeNull();
});

test('renameStandard keeps a renaming and drops it when back to the original', () => {
  const draft = boat();
  const { key, label } = firstField();
  expect(standardLabel(key)).toBe(label);
  renameStandard(draft, key, ' Nom perso ');
  expect(draft.alias).toStrictEqual({ [key]: 'Nom perso' });
  renameStandard(draft, key, label);
  expect(draft.alias).toBeUndefined();
  renameStandard(draft, key, 'Autre');
  renameStandard(draft, key, ' '.repeat(3));
  expect(draft.alias).toBeUndefined();
});

test('addLabel appends to the end of the Informations section', () => {
  const draft = boat();
  const id = addLabel(draft, 'Code du cadenas');
  const lines = flatLabels(draft);
  const position = lines.findIndex((line) => line.cid === id);
  expect(lines[position]?.label).toBe('Code du cadenas');
  const section = lines.findLastIndex((line) => line.sec === 'Informations');
  expect(position).toBeGreaterThan(section);
  const next = lines[position + 1];
  expect(next === undefined || Boolean(next.sec)).toBe(true);
});

test('moveLabel moves a custom label by one line', () => {
  const draft = boat();
  const id = addLabel(draft, 'Code');
  const before = flatLabels(draft).findIndex((line) => line.cid === id);
  expect(moveLabel(draft, id, -1)).toBe(true);
  const after = flatLabels(draft).findIndex((line) => line.cid === id);
  expect(after).toBe(before - 1);
  expect(moveLabel(draft, 'unknown', 1)).toBe(false);
});

test('removeLabel deletes the label, its value and keeps the others in place', () => {
  const draft = boat();
  const first = addLabel(draft, 'Un');
  const second = addLabel(draft, 'Deux');
  draft.info[`x_${first}`] = 'valeur';
  removeLabel(draft, first);
  expect(draft.custom?.map((custom) => custom.id)).toStrictEqual([second]);
  expect(draft.info[`x_${first}`]).toBeUndefined();
  expect(flatLabels(draft).some((line) => line.cid === second)).toBe(true);
});
