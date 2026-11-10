import { describe, expect, it } from 'vitest';

import { ageText, compassPoint, windColors } from '../liveText.ts';

describe('live weather texts', () => {
  it('names the compass point of a wind', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(225)).toBe('SO');
    expect(compassPoint(270)).toBe('O');
    expect(compassPoint(-90)).toBe('O');
  });

  it('says how old a measurement is', () => {
    expect(ageText(1000, 20_000)).toBe('à l’instant');
    expect(ageText(0, 7 * 60_000)).toBe('il y a 7 min');
  });

  it('colours a calm wind apart from the alerts', () => {
    expect(windColors(5).color).toBe('#9ec9e8');
    expect(windColors(12).color).toBe('#7ed957');
  });
});
