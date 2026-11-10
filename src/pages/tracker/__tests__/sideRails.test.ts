import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend } from '../../../storage/store.ts';
import {
  DEFAULT_RAILS,
  RAIL_SLOTS,
  loadRails,
  setRail,
  splitTitle,
} from '../sideRails.ts';

describe('side rails', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage({}));
  });

  it('starts with the example buttons', () => {
    expect(loadRails()).toEqual(DEFAULT_RAILS);
    expect(DEFAULT_RAILS.left).toHaveLength(RAIL_SLOTS);
    expect(DEFAULT_RAILS.right).toHaveLength(RAIL_SLOTS);
  });

  it('keeps a button put on a free place, and frees it again', () => {
    const added = setRail(loadRails(), 'right', 4, 'checklist');
    expect(loadRails().right[4]).toBe('checklist');
    expect(loadRails().left).toEqual(DEFAULT_RAILS.left);
    setRail(added, 'right', 4, '');
    expect(loadRails().right[4]).toBe('');
  });

  it('splits the icon from the words', () => {
    expect(splitTitle('🌤 Météo')).toEqual({ icon: '🌤', label: 'Météo' });
    expect(splitTitle('Mes cartes')).toEqual({
      icon: '',
      label: 'Mes cartes',
    });
  });
});
