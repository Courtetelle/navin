import type { Scenario } from '../types.ts';

import { chartScenarios } from './mapChart.ts';
import { journalScenarios } from './mapJournal.ts';
import { listScenarios } from './mapLists.ts';
import { trackerScenarios } from './mapTracker.ts';
import { trackerFlowScenarios } from './mapTrackerFlows.ts';

export const scenarios: Scenario[] = [
  ...trackerScenarios,
  ...trackerFlowScenarios,
  ...chartScenarios,
  ...journalScenarios,
  ...listScenarios,
];
