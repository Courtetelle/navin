import type { Scenario } from '../types.ts';

import { crewCardsScenarios } from './crewCards.ts';
import { crewCrewsScenarios } from './crewCrews.ts';
import { crewSheetsScenarios } from './crewSheets.ts';

export const scenarios: Scenario[] = [
  ...crewCardsScenarios,
  ...crewCrewsScenarios,
  ...crewSheetsScenarios,
];
