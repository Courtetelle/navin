import type { Scenario } from '../types.ts';

import { checklistsBasesScenarios } from './checklistsBases.ts';
import { checklistsCruiseScenarios } from './checklistsCruise.ts';
import { checklistsEditScenarios } from './checklistsEdit.ts';

export const scenarios: Scenario[] = [
  ...checklistsCruiseScenarios,
  ...checklistsEditScenarios,
  ...checklistsBasesScenarios,
];
