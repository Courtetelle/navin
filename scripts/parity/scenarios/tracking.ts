import type { Scenario } from '../types.ts';

import { instrumentScenarios } from './trackingInstruments.ts';
import { liveScenarios } from './trackingLive.ts';
import { settingsScenarios } from './trackingSettings.ts';

export const scenarios: Scenario[] = [
  ...instrumentScenarios,
  ...liveScenarios,
  ...settingsScenarios,
];
