import type { Scenario } from '../types.ts';

import { pageScenarios } from './publishPages.ts';
import { windowScenarios } from './publishWindows.ts';

export const scenarios: Scenario[] = [...pageScenarios, ...windowScenarios];
