import type { Scenario } from '../types.ts';

import { onwaterMoreScenarios } from './onwaterMore.ts';
import { onwaterScreensScenarios } from './onwaterScreens.ts';
import { onwaterWindScenarios } from './onwaterWind.ts';

export const scenarios: Scenario[] = [
  ...onwaterScreensScenarios,
  ...onwaterWindScenarios,
  ...onwaterMoreScenarios,
];
