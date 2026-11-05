import type { Scenario } from '../types.ts';

export const scenarios: Scenario[] = [
  {
    name: 'smoke-empty-boot',
    steps: [{ snapshot: 'boot' }],
  },
];
