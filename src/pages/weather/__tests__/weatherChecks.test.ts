import { describe, expect, it } from 'vitest';

import { weatherChecks } from '../../../model/weatherChecks.ts';

describe('weatherChecks', () => {
  it('asks for the sea state at sea, the storms on a lake', () => {
    const sea = weatherChecks(false).map((check) => check.id);
    const lake = weatherChecks(true).map((check) => check.id);
    expect(sea).toContain('sea');
    expect(lake).toContain('storms');
    expect(sea).toHaveLength(6);
    expect(new Set(lake).size).toBe(6);
  });
});
