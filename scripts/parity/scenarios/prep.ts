import type { Scenario } from '../types.ts';

import { prepDepartureScenarios } from './prepDeparture.ts';
import { prepFlowsScenarios } from './prepFlows.ts';
import { prepSwipeScenarios } from './prepSwipe.ts';

export const scenarios: Scenario[] = [
  ...prepFlowsScenarios,
  ...prepDepartureScenarios,
  ...prepSwipeScenarios,
];
