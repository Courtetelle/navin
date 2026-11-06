import type { Scenario } from '../types.ts';

import { cruiseScenarios } from './dataCruises.ts';
import { fileScenarios } from './dataFiles.ts';
import { screenScenarios } from './dataScreens.ts';
import { settingsScenarios } from './dataSettings.ts';

/** Data domain scenarios: data menu, cruises, info, crew, print, files, no-cruise page, settings. */
export const scenarios: Scenario[] = [
  ...cruiseScenarios,
  ...screenScenarios,
  ...settingsScenarios,
  ...fileScenarios,
];
