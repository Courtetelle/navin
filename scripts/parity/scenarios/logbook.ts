import type { Scenario } from '../types.ts';

import { logbookCompactScenarios } from './logbookCompact.ts';
import { logbookDayScenarios } from './logbookDay.ts';
import { logbookEntriesScenarios } from './logbookEntries.ts';
import { logbookNewScenarios } from './logbookNew.ts';

export const scenarios: Scenario[] = [
  ...logbookNewScenarios,
  ...logbookEntriesScenarios,
  ...logbookDayScenarios,
  ...logbookCompactScenarios,
];
