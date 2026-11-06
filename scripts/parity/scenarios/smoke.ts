import type { Scenario } from '../types.ts';

export const scenarios: Scenario[] = [
  {
    name: 'smoke-empty-boot',
    overrides: { 'ldb.tipIdx': '6' },
    steps: [{ snapshot: 'boot' }],
  },
];
