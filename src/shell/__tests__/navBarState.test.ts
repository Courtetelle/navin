import { expect, test } from 'vitest';

import { navBackLabel } from '../navbar/navBarState.ts';

test('the nav bar back button reads the page back button without its arrow', () => {
  expect(navBackLabel({ label: '◀ Équipages' }, false)).toBe('Équipages');
  expect(navBackLabel({ label: '◀ Plus' }, false)).toBe('data');
  expect(navBackLabel({ label: '✔ Terminé' }, false)).toBe('✔ Terminé');
  expect(navBackLabel(null, false)).toBe('Retour');
  expect(navBackLabel({ label: '◀ Équipages' }, true)).toBe('Retour');
});
