import type { Scenario } from '../types.ts';

import { safetyMobScenarios } from './safetyMob.ts';
import { safetySosScenarios } from './safetySos.ts';
import { safetyVhfScenarios } from './safetyVhf.ts';

export const scenarios: Scenario[] = [
  ...safetySosScenarios,
  ...safetyMobScenarios,
  ...safetyVhfScenarios,
];
